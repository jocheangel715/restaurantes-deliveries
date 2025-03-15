import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import './home.css';

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const stringValue = value.toString();
  const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));

  if (isNaN(numberValue) || numberValue === 0) return '$0';

  return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const Home = () => {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState(0);
  const [orders, setOrders] = useState([]);
  const [userId, setUserId] = useState(''); // New state variable for user ID

  useEffect(() => {
    const fetchUserData = async (user) => {
      try {
        const db = getFirestore();
        const q = query(collection(db, 'CLIENTES'), where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          setName(data.name);
          setBalance(formatPrice(data.Balance)); // Use formatPrice for balance
          setOrders(data.Orders || []);
          setUserId(data.id); // Set user ID
          console.log('User ID:', data.id); // Log user ID to console
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
  }, []);

  const handleLogout = () => {
    const auth = getAuth(); // Ensure auth is defined here
    signOut(auth).then(() => {
      localStorage.removeItem('email');
      localStorage.removeItem('password');
      window.location.href = '/restaurantes-deliveries';
    }).catch((error) => {
      console.error('Error signing out: ', error);
    });
  };

  return (
    <div className="home-container">
      <h1 className="welcome-message">Bienvenido {name}</h1>
      <div className="balance">Balance: {balance}</div>
      <div className="orders">
        <h2>Pedidos</h2>
        <ul>
          {orders.map((order, index) => (
            <li key={index}>{order}</li>
          ))}
        </ul>
      </div>
      <button className="logout-button" onClick={handleLogout}>Cerrar Sesión</button>
    </div>
  );
};

export default Home;