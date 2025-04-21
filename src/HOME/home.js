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

const determineDateAndShift = () => {
  const now = new Date();
  let date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
  let period = 'MORNING';

  const hours = now.getHours();
  if (hours >= 17 || hours < 3) {
    period = 'NIGHT';
    if (hours < 3) {
      const previousDay = new Date(now);
      previousDay.setDate(now.getDate() - 1);
      date = `${previousDay.getDate()}-${previousDay.getMonth() + 1}-${previousDay.getFullYear()}`;
    }
  } else if (hours >= 3 && hours < 6) {
    period = 'NIGHT';
    const previousDay = new Date(now);
    previousDay.setDate(now.getDate() - 1);
    date = `${previousDay.getDate()}-${previousDay.getMonth() + 1}-${previousDay.getFullYear()}`;
  }

  return { date, period };
};

const Home = () => {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState({ EFECTIVO: 0, NEQUI: 0, total: 0 }); // Remove caja
  const [orders, setOrders] = useState([]);
  const [userId, setUserId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null); // State for selected order
  const [period, setPeriod] = useState('MORNING'); // State for selected period
  const navigate = useNavigate(); // Initialize navigate

  const handlePeriodChangeFromVerPedidos = (selectedPeriod) => {
    setPeriod(selectedPeriod); // Update the period state when VerPedidos changes it
  };

  useEffect(() => {
    const fetchUserData = async (user) => {
      try {
        const db = getFirestore();
        const q = query(collection(db, 'EMPLEADOS'), where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (docSnapshot) => {
          const data = docSnapshot.data();
          setName(data.name);
          setUserId(data.id);

          const { date } = determineDateAndShift(); // Only get the date

          const balanceDocRef = doc(db, 'DOMICILIOS', date);

          onSnapshot(balanceDocRef, (balanceDoc) => {
            if (balanceDoc.exists()) {
              const periodData = balanceDoc.data()[data.id] ? balanceDoc.data()[data.id][period] : null; // Use selected period here
              const balanceData = periodData && periodData.balance ? periodData.balance : { EFECTIVO: 0, NEQUI: 0 };
              const EFECTIVO = balanceData.EFECTIVO || 0;
              const NEQUI = balanceData.NEQUI || 0;
              const total = EFECTIVO + NEQUI;
              setBalance({ EFECTIVO, NEQUI, total });

              // Set orders based on selected period
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
  }, [period]); // Add period as a dependency


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
          <VerPedidos onPeriodChange={handlePeriodChangeFromVerPedidos} /> {/* Pass the callback to VerPedidos */}
        </div>
      </div>
      <button className="logout-button" onClick={handleLogout}>Cerrar Sesión</button>
      {/* Modal de detalles del pedido */}
      {selectedOrder && (
        <Detalles
          order={selectedOrder}
          closeModal={() => setSelectedOrder(null)}
          userId={userId} // Pass userId to Detalles
        />
      )}
    </div>
  );
};

export default Home;