import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import Detalles from '../RESOURCES/DETALLES/Detalles'; // Import Detalles component
import './VerPedidos.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Import getAuth and onAuthStateChanged
import { getFirestore, query, collection, where, getDocs } from 'firebase/firestore'; // Import missing Firestore functions

const VerPedidos = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null); // State for selected order
  const [period, setPeriod] = useState('MORNING'); // State for selected period
  const [userId, setUserId] = useState(''); // State for user ID

  useEffect(() => {
    const fetchUserId = async () => {
      const auth = getAuth();
      onAuthStateChanged(auth, (user) => {
        if (user) {
          const db = getFirestore();
          const q = query(collection(db, 'CLIENTES'), where('email', '==', user.email));
          getDocs(q).then((querySnapshot) => {
            querySnapshot.forEach((docSnapshot) => {
              const data = docSnapshot.data();
              setUserId(data.id);
            });
          });
        }
      });
    };

    fetchUserId();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchOrders = () => {
      const now = new Date();
      const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const docId = date;

      const docRef = doc(db, 'DOMICILIOS', docId);
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const userOrders = data[userId] ? data[userId][period] : null;
          const items = userOrders ? Object.keys(userOrders).filter(key => key !== 'balance').map(key => ({ id: key, ...userOrders[key] })) : [];
          const filteredItems = items.filter(item => item.status !== 'ENTREGADOs');
          filteredItems.sort((a, b) => (b.timestamp && b.timestamp.toDate()) - (a.timestamp && a.timestamp.toDate())); // Sort by timestamp
          setOrders(filteredItems);
        } else {
          // No such document
        }
      });

      return () => unsubscribe();
    };

    fetchOrders();
  }, [period, userId]);

  const printOrderDetails = (order, indent = 0) => {
    const indentation = ' '.repeat(indent);
    for (const key in order) {
      if (typeof order[key] === 'object' && order[key] !== null) {
        // Print nested object details
        printOrderDetails(order[key], indent + 2);
      } else {
        // Print key-value pair
      }
    }
  };

  const printCollectionDetails = async (collectionName, indent = 0) => {
    const indentation = ' '.repeat(indent);
    const db = getFirestore();
    const collectionRef = collection(db, collectionName);
    const querySnapshot = await getDocs(collectionRef);
    querySnapshot.forEach((docSnapshot) => {
      printOrderDetails(docSnapshot.data(), indent + 4);
    });
  };

  const handleOrderClick = async (order) => {
    setSelectedOrder(order);
    console.log('Order ID:', order.id); // Log the order ID

    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const db = getFirestore();
      const q = query(collection(db, 'CLIENTES'), where('email', '==', user.email));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        console.log('Domiciliario ID:', data.id); // Log the delivery person's ID
        order.deliveryPersonId = data.id; // Save the delivery person's ID in the order

        // Set the IDEPEDIDOAHORA field
        const docRef = doc(db, 'DOMICILIOS', `${new Date().getDate()}-${new Date().getMonth() + 1}-${new Date().getFullYear()}`);
        getDoc(docRef).then((docSnap) => {
          if (docSnap.exists()) {
            const domiciliosData = docSnap.data();
            const domiciliarioData = domiciliosData[data.id];
            if (domiciliarioData) {
              const orderKeys = Object.keys(domiciliarioData).filter(key => key !== 'balance');
              orderKeys.forEach((key) => {
                if (domiciliarioData[key].id === order.id) {
                  order.IDEPEDIDOAHORA = key;
                  console.log('IDEPEDIDOAHORA:', key); // Log the IDEPEDIDOAHORA field
                }
              });
            }
          }
        });
      });
    }

    await printCollectionDetails('DOMICILIOS', 2);
    await printCollectionDetails('CLIENTES', 2);
  };

  const handlePeriodChange = (e) => {
    setPeriod(e.target.value);
  };

  return (
    <div className="verpedidos-container">
      <ToastContainer />
      <h2>Pedidos Recientes</h2>
      <div className="period-select">
        <label htmlFor="period">Seleccionar Periodo:</label>
        <select id="period" className='period-select-dropdown' value={period} onChange={handlePeriodChange}>
          <option value="MORNING">MORNING</option>
          <option value="NIGHT">NIGHT</option>
        </select>
      </div>
      <div className="verpedidos-orders-list">
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
              key={order.id}
              className={`verpedidos-order-item ${statusClass}`}
              onClick={() => handleOrderClick(order)}
            >
              <h3>Pedido #{order.id}</h3>
              <p><strong>Cliente:</strong> {order.clientName}</p>
              <p><strong>Teléfono:</strong> {order.clientPhone}</p>
              <p><strong>Dirección:</strong> {order.clientAddress} - {order.clientBarrio}</p>
              <p><strong>Total:</strong> {order.total}</p>
              <p><strong>Estado:</strong> {order.status}</p>
              <p><strong>Fecha:</strong> {order.timestamp ? order.timestamp.toDate().toLocaleString() : 'N/A'}</p>
            </div>
          );
        })}
      </div>

      {/* Modal de detalles del pedido */}
      {selectedOrder && (
        <Detalles
          order={selectedOrder}
          closeModal={() => setSelectedOrder(null)}
          orderId={selectedOrder.id} // Pass the order ID to the Detalles component
          deliveryPersonId={selectedOrder.deliveryPersonId} // Pass the delivery person ID to the Detalles component
        />
      )}
    </div>
  );
};

export default VerPedidos;
