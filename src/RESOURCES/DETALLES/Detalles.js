import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Detalles.css';

const Detalles = ({ order, closeModal, orderId }) => {
  const [isDomicilio, setIsDomicilio] = useState(false);
  const [incorrectPayment, setIncorrectPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const db = getFirestore();
          const q = query(collection(db, 'CLIENTES'), where('email', '==', user.email));
          const querySnapshot = await getDocs(q);

          querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            setName(data.name);
            setUserId(data.id);
          });
        } catch (error) {
          console.error('Error obteniendo datos del usuario:', error);
        }
      }
    });
  }, [orderId]);

  const actualizarPedido = async (status) => {
    try {
      const now = new Date();
      const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const docId = date;
  
      const orderDoc = doc(db, 'PEDIDOS', docId);
      const orderSnapshot = await getDoc(orderDoc);
  
      if (orderSnapshot.exists()) {
        const data = orderSnapshot.data();
        const period = now.getHours() < 17 ? 'MORNING' : 'NIGHT';
  
        if (data[period]) {
          const orderKeys = Object.keys(data[period]);
          let orderFound = false;
  
          orderKeys.forEach((key) => {
            if (data[period][key].idPedido === orderId) {
              data[period][key].status = status;
              if (incorrectPayment) {
                data[period][key].paymentMethod = paymentMethod;
              }
              orderFound = true;
            }
          });
  
          if (orderFound) {
            await setDoc(orderDoc, { [period]: data[period] }, { merge: true });
            toast.success(`Pedido actualizado a ${status}`);
            closeModal();
          } else {
            toast.error('Pedido no encontrado');
          }
        } else {
          toast.error('No hay pedidos en este turno');
        }
      } else {
        toast.error('Documento de pedidos no encontrado');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Error al actualizar el estado del pedido');
    }
  };
  const updateOrderStatus = async (status) => {
    try {
      const now = new Date();
      const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const docId = date;

      const orderDoc = doc(db, 'DOMICILIOS', docId);
      const orderSnapshot = await getDoc(orderDoc);

      if (orderSnapshot.exists()) {
        const data = orderSnapshot.data();
        const period = now.getHours() < 17 ? 'MORNING' : 'NIGHT';
        const domiciliarioData = data[userId] || {};

        if (domiciliarioData[period]) {
          const orderKeys = Object.keys(domiciliarioData[period]).filter(key => key !== 'balance');
          let orderFound = false;

          orderKeys.forEach((key) => {
            if (domiciliarioData[period][key].id === orderId) {
              domiciliarioData[period][key].status = status;
              if (incorrectPayment) {
                domiciliarioData[period][key].paymentMethod = paymentMethod;
              }
              orderFound = true;
            }
          });

          if (orderFound) {
            const paymentMethodToUse = incorrectPayment ? paymentMethod : order.paymentMethod;
            const balance = domiciliarioData[period].balance || { EFECTIVO: 0, NEQUI: 0 };
            balance[paymentMethodToUse] = (balance[paymentMethodToUse] || 0) + order.total;

            await setDoc(orderDoc, { [userId]: { [period]: { ...domiciliarioData[period], balance } } }, { merge: true });
            toast.success(`Pedido actualizado a ${status}`);
            
            // Call actualizarPedido to update the order status in the 'PEDIDOS' collection
            await actualizarPedido(status);
          } else {
            toast.error('Pedido no encontrado');
          }
        } else {
          toast.error('Datos del domiciliario no encontrados');
        }
      } else {
        toast.error('Documento de pedidos no encontrado');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Error al actualizar el estado del pedido');
    }
  };


  const handleEntregado = () => {
    if (!orderId || !userId) {
      toast.error('Faltan datos del pedido o domiciliario');
      return;
    }
    updateOrderStatus('ENTREGADO');
  };

  const openWhatsApp = (phoneNumber) => {
    const whatsappUrl = `https://wa.me/${phoneNumber}`;
    window.open(whatsappUrl, '_blank');
  };
  const openGoogleMaps = (address) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(mapsUrl, '_blank');
  };

  return (
    <div className="detalles-container">
      <ToastContainer />
      <div className="detalles-overlay" onClick={closeModal}></div>
      <div className="detalles-modal">
        <div className="detalles-modal-content">
          <span className="detalles-close" onClick={closeModal}>&times;</span>
          <h2>Detalles del Pedido</h2>
          <div className="detalles-content">
            <h3>Información del Cliente:</h3>
            <p><strong>Nombre:</strong> {order.clientName}</p>
            <p>
              <strong>Teléfono:</strong> {order.clientPhone}
              <button 
                className="whatsapp-button" 
                onClick={() => openWhatsApp(order.clientPhone)}
              >
                WhatsApp
              </button>
            </p>
            <p>
              <strong>Dirección:</strong> {order.clientAddress}
              <button 
                className="maps-button" 
                onClick={() => openGoogleMaps(order.clientAddress)}
              >
                Maps
              </button>
            </p>
            <p><strong>Barrio:</strong> {order.clientBarrio}</p>
            <p><strong>Método de Pago:</strong> {incorrectPayment ? paymentMethod : order.paymentMethod}</p> {/* Display payment method */}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={incorrectPayment}
                onChange={() => setIncorrectPayment(!incorrectPayment)}
              />
              El pago no fue por el método de pago correcto?
            </label>
            {incorrectPayment && (
              <select
                className="period-select-dropdown"
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                }}
              >
                <option value="">Seleccionar método de pago</option>
                <option value="NEQUI">NEQUI</option>
                <option value="EFECTIVO">EFECTIVO</option>
              </select>
            )}
            <h3>Productos:</h3>
            {order.cart.map((product, index) => (
              <div key={index}>
                <span>{product.name}</span>
                <ul>
                  {product.ingredients.map((ingredient) => (
                    <li key={ingredient}>Sin {ingredient}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button className="detalles-button" onClick={handleEntregado}>ENTREGADO</button>
        </div>
      </div>
    </div>
  );
};

export default Detalles;
