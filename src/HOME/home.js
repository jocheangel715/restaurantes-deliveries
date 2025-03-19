import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import './home.css';
import Detalles from '../RESOURCES/DETALLES/Detalles'; // Import Detalles component
import VerPedidos from '../VERPEDIDOS/VerPedidos'; // Import VerPedidos component

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const stringValue = value.toString();
  const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));

  if (isNaN(numberValue) || numberValue === 0) return '$0';

  return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const Home = () => {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState({ EFECTIVO: 0, NEQUI: 0, total: 0 }); // Remove caja
  const [orders, setOrders] = useState([]);
  const [userId, setUserId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null); // State for selected order
  const [period, setPeriod] = useState('MORNING'); // State for selected period
  const navigate = useNavigate(); // Initialize navigate

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

          // Determinar el periodo del día
          const now = new Date();
          const hour = now.getHours();
          const selectedPeriod = hour >= 17 ? 'NIGHT' : 'MORNING'; // Cambia a 'NIGHT' desde las 18:00 hasta las 23:59

          const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
          const balanceDocRef = doc(db, 'DOMICILIOS', dateStr);

          onSnapshot(balanceDocRef, (balanceDoc) => {
            if (balanceDoc.exists()) {
              const periodData = balanceDoc.data()[data.id] ? balanceDoc.data()[data.id][selectedPeriod] : null;
              const balanceData = periodData && periodData.balance ? periodData.balance : { EFECTIVO: 0, NEQUI: 0 };
              const EFECTIVO = balanceData.EFECTIVO || 0;
              const NEQUI = balanceData.NEQUI || 0;
              const total = EFECTIVO + NEQUI;
              setBalance({ EFECTIVO, NEQUI, total });

              // Set orders based on time of day
              const ordersData = periodData && periodData.orders ? Object.keys(periodData.orders).map(key => ({
                idPedido: key,
                ...periodData.orders[key]
              })) : [];
              setOrders(ordersData);
            } else {
              console.error('No balance document found');
            }
          });
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
        <div>Efectivo: {formatPrice(balance.EFECTIVO)}</div>
        <div>Nequi: {formatPrice(balance.NEQUI)}</div>
        <div>Total: {formatPrice(balance.total)}</div>
      </div>
      <div className="orders">
        <div className="pedidos-container">
          <VerPedidos /> {/* Render VerPedidos component */}
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