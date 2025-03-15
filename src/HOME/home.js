import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import './home.css';
import Detalles from '../RESOURCES/DETALLES/Detalles'; // Import Detalles component

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const stringValue = value.toString();
  const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));

  if (isNaN(numberValue) || numberValue === 0) return '$0';

  return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const Home = () => {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState({ efectivo: 0, nequi: 0, caja: 0, total: 0 });
  const [orders, setOrders] = useState([]);
  const [userId, setUserId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null); // State for selected order
  const [period, setPeriod] = useState('MORNING'); // State for selected period

  useEffect(() => {
    const fetchUserData = async (user) => {
      try {
        const db = getFirestore();
        const q = query(collection(db, 'CLIENTES'), where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (docSnapshot) => {
          const data = docSnapshot.data();
          setName(data.name);
          setUserId(data.id);
          console.log('User ID:', data.id);

          // Fetch balance and orders based on time of day
          const now = new Date();
          const hour = now.getHours();
          const selectedPeriod = hour >= 17 ? 'NIGHT' : 'MORNING';
          const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
          const balanceDocRef = doc(db, 'DOMICILIOS', dateStr);
          const balanceDoc = await getDoc(balanceDocRef);

          if (balanceDoc.exists()) {
            const periodData = balanceDoc.data()[data.id][selectedPeriod];
            const balanceData = periodData.balance;
            const efectivo = balanceData.efectivo || 0;
            const nequi = balanceData.nequi || 0;
            const caja = balanceData.caja || 0;
            const total = efectivo + nequi + caja;
            setBalance({ efectivo, nequi, caja, total });

            // Set orders based on time of day
            const ordersData = Object.keys(periodData.orders || {}).map(key => ({
              id: key,
              ...periodData.orders[key]
            }));
            setOrders(ordersData);
          } else {
            console.error('No balance document found');
          }
        });
      } catch (error) {
        console.error('Error fetching user data: ', error);
      }
    };

    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUserData(user);
      }
    });
  }, [period]);

  const handleLogout = () => {
    const auth = getAuth();
    signOut(auth).then(() => {
      localStorage.removeItem('email');
      localStorage.removeItem('password');
      window.location.href = '/restaurantes-deliveries';
    }).catch((error) => {
      console.error('Error signing out: ', error);
    });
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
  };

  const handlePeriodChange = (e) => {
    setPeriod(e.target.value);
  };

  return (
    <div className="home-container">
      <h1 className="welcome-message">Bienvenido {name}</h1>
      <div className="balance">
        <div>Efectivo: {formatPrice(balance.efectivo)}</div>
        <div>Nequi: {formatPrice(balance.nequi)}</div>
        <div>Caja: {formatPrice(balance.caja)}</div>
        <div>Total: {formatPrice(balance.total)}</div>
      </div>
      <div className="orders">
        <h2>Pedidos</h2>
        <div className="period-select">
          <label htmlFor="period">Seleccionar Periodo:</label>
          <select id="period" value={period} onChange={handlePeriodChange}>
            <option value="MORNING">MORNING</option>
            <option value="NIGHT">NIGHT</option>
          </select>
        </div>
        <div className="pedidos-container">
          {orders.map((order) => {
            let statusClass = '';
            switch (order.status) {
              case 'PEDIDOTOMADO':
                statusClass = 'pedido-tomado';
                break;
              case 'ENCOCINA':
                statusClass = 'en-cocina';
                break;
              case 'ENDOMICILIO':
                statusClass = 'domicilio';
                break;
              default:
                break;
            }
            return (
              <div
                key={order.idPedido}
                className={`verpedidos-order-item ${statusClass}`}
                onClick={() => handleOrderClick(order)}
              >
                <h3>Pedido #{order.idPedido}</h3>
                <p><strong>Cliente:</strong> {order.clientName}</p>
                <p><strong>Teléfono:</strong> {order.clientPhone}</p>
                <p><strong>Dirección:</strong> {order.clientAddress} - {order.clientBarrio}</p>
                <p><strong>Total:</strong> {order.total}</p>
                <p><strong>Estado:</strong> {order.status}</p>
                <p><strong>Fecha:</strong> {order.timestamp.toDate().toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      </div>
      <button className="logout-button" onClick={handleLogout}>Cerrar Sesión</button>

      {/* Modal de detalles del pedido */}
      {selectedOrder && (
        <Detalles
          order={selectedOrder}
          closeModal={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};

export default Home;