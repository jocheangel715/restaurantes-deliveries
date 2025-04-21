import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Detalles.css';

const Detalles = ({ order, closeModal, orderId, userId }) => { // Accept userId as a prop
  const [isDomicilio, setIsDomicilio] = useState(false);
  const [incorrectPayment, setIncorrectPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [name, setName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [partialPayment, setPartialPayment] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');

  useEffect(() => {
    if (!userId) {
      console.error('User ID is missing');
    }
  }, [userId]);

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

  const actualizarPedido = async (status) => {
    try {
      const { date, period } = determineDateAndShift();
      const docId = date;
  
      const orderDoc = doc(db, 'PEDIDOS', docId);
      const orderSnapshot = await getDoc(orderDoc);
  
      if (orderSnapshot.exists()) {
        const data = orderSnapshot.data();
  
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
      const { date, period } = determineDateAndShift();
      const docId = date;

      const orderDoc = doc(db, 'DOMICILIOS', docId);
      const orderSnapshot = await getDoc(orderDoc);

      if (orderSnapshot.exists()) {
        const data = orderSnapshot.data();
        const domiciliarioData = data[userId] || {}; // Use passed userId directly

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

            if (partialPayment && partialAmount) {
              const partialValue = parseFloat(partialAmount.replace(/[$,]/g, '')) || 0;
              balance[paymentMethodToUse] = (parseFloat(balance[paymentMethodToUse]) || 0) + partialValue;
              const remainingValue = order.total - partialValue;
              const otherMethod = paymentMethodToUse === 'EFECTIVO' ? 'NEQUI' : 'EFECTIVO';
              balance[otherMethod] = (parseFloat(balance[otherMethod]) || 0) + remainingValue;
            } else {
              balance[paymentMethodToUse] = (parseFloat(balance[paymentMethodToUse]) || 0) + order.total;
            }

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

  const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    
    const numberValue = parseFloat(value.toString().replace(/[$,]/g, ''));
    
    if (isNaN(numberValue)) return '0';

    return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const groupProducts = (cart) => {
  const grouped = {};
  cart.forEach((product) => {
    if (grouped[product.name]) {
      grouped[product.name].quantity += 1;
    } else {
      grouped[product.name] = { ...product, quantity: 1 };
    }
  });
  return Object.values(grouped);
};

  const handleEntregado = async () => {
    if (!orderId || !userId) {
      toast.error('Faltan datos del pedido o domiciliario');
      return;
    }
    setIsProcessing(true);
    await updateOrderStatus('ENTREGADO');
    setIsProcessing(false);
  };

  const openWhatsApp = (phoneNumber) => {
    const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+57${phoneNumber}`;
    const whatsappUrl = `https://wa.me/${formattedPhoneNumber}`;
    window.open(whatsappUrl, '_blank');
  };

  const openGoogleMaps = (address) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(mapsUrl, '_blank');
  };

  const getModalStyle = () => {
    if (incorrectPayment && paymentMethod) {
      return paymentMethod === 'EFECTIVO' ? { backgroundColor: '#014421' } : { backgroundColor: '#0a2f3d' };
    }
    return order.paymentMethod === 'EFECTIVO' ? { backgroundColor: '#014421' } : { backgroundColor: '#0a2f3d' };
  };

  return (
    <div className="detalles-container">
      <ToastContainer />
      <div className="detalles-overlay" onClick={closeModal}></div>
      <div className="detalles-modal" style={getModalStyle()}>
        <div className="detalles-modal-content">
          <span className="detalles-close" onClick={closeModal}>&times;</span>
          <h2>Detalles del Pedido</h2>
          <div className="detalles-content">
            <h3>Información del Cliente:</h3>
            <p><strong>Nombre:</strong> {order.clientName}</p>
            <p><strong>Número del Pedido:</strong> {orderId}</p> {/* Display order number */}
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
            <p><strong>Total:</strong> {formatPrice(order.total)}</p> {/* Display total */}
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
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={partialPayment}
                onChange={() => setPartialPayment(!partialPayment)}
              />
              ¿El pago fue parcial?
            </label>
            {partialPayment && (
              <input
                type="text"
                className="partial-payment-input"
                placeholder="Ingrese el monto recibido"
                value={partialAmount}
                onChange={(e) => setPartialAmount(formatPrice(e.target.value))}
              />
            )}
            <h3>Productos:</h3>
            {groupProducts(order.cart).map((product, index) => (
              <div key={index}>
                <span><strong>{product.quantity}X</strong>{product.name}</span>
                <ul>
                  {product.ingredients.map((ingredient) => (
                    <li key={ingredient}>Sin {ingredient}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button 
            className="detalles-button" 
            onClick={handleEntregado} 
            disabled={isProcessing}
          >
            {isProcessing ? 'Procesando...' : 'ENTREGADO'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Detalles;
