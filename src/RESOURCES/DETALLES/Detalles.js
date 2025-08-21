import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Detalles.css';
import { Wifi, WifiOff } from "lucide-react"; // Íconos bonitos de wifi (lucide-react)


const Detalles = ({ order, closeModal, orderId, userId }) => { // Accept userId as a prop
  const [isDomicilio, setIsDomicilio] = useState(false);
  const [incorrectPayment, setIncorrectPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [name, setName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [partialPayment, setPartialPayment] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [showRecommendationModal, setShowRecommendationModal] = useState(false);
  const [recommendationField, setRecommendationField] = useState('');
  const [connectionStatus, setConnectionStatus] = useState({ good: false, speed: 0 });
  const [recommendationValues, setRecommendationValues] = useState({
    clientName: '',
    clientPhone: '',
    clientAddress: '',
    clientBarrio: ''
  });

  useEffect(() => {
  if (!userId) {
    console.error("User ID is missing");
  }

  const checkConnection = async () => {
    try {
      // medir latencia simple con un ping a google
      const start = Date.now();
      await fetch("https://www.google.com", { mode: "no-cors" });
      const latency = Date.now() - start;

      // obtener info de la API de Network Information
      const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

      const downlink = connection?.downlink || 0; // Mbps estimados

      // criterio: buena conexión si latencia < 200ms y velocidad > 1Mbps
      const good = latency < 200 && downlink > 1;
      setConnectionStatus({ good, speed: downlink });
    } catch (error) {
      setConnectionStatus({ good: false, speed: 0 });
    }
  };

  checkConnection(); // ejecutar al inicio
  const interval = setInterval(checkConnection, 10000); // revisar cada 10s

  return () => clearInterval(interval);
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
              // Si el método de pago es CUENTA, solo actualiza estado y método de pago
              if ((incorrectPayment ? paymentMethod : order.paymentMethod) === 'CUENTA') {
                orderFound = true;
                return;
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

            // Si el método de pago es CUENTA, solo actualiza el estado, no el balance
            if (paymentMethodToUse === 'CUENTA') {
              await setDoc(orderDoc, { [userId]: { [period]: { ...domiciliarioData[period] } } }, { merge: true });
              toast.success(`Pedido actualizado a ${status}`);
              // Call actualizarPedido to update the order status in the 'PEDIDOS' collection
              await actualizarPedido(status);
              return;
            }

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
    const method = incorrectPayment && paymentMethod ? paymentMethod : order.paymentMethod;
    if (method === 'CUENTA') {
      return { backgroundColor: '#fa2c57' };
    }
    if (incorrectPayment && paymentMethod) {
      return paymentMethod === 'EFECTIVO' ? { backgroundColor: '#014421' } : { backgroundColor: '#0a2f3d' };
    }
    return order.paymentMethod === 'EFECTIVO' ? { backgroundColor: '#014421' } : { backgroundColor: '#0a2f3d' };
  };

  const openRecommendationModal = (field) => {
    setRecommendationField(field);
    setRecommendationValues({
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      clientAddress: order.clientAddress,
      clientBarrio: order.clientBarrio
    });
    setShowRecommendationModal(true);
  };

  const handleRecommendationChange = (e) => {
    setRecommendationValues({
      ...recommendationValues,
      [e.target.name]: e.target.value
    });
  };

  const handleRecommend = async () => {
    try {
      if (!order.clientId) {
        toast.error('No se encontró el id del cliente');
        return;
      }
      const docRef = doc(db, 'RECOMENDACIONES', order.clientId);
      await setDoc(docRef, {
        ...recommendationValues,
        timestamp: new Date()
      });
      toast.success('¡Recomendación enviada!');
      setShowRecommendationModal(false);
    } catch (error) {
      toast.error('Error al enviar la recomendación');
    }
  };

  return (
  <div className="detalles-container">
    <ToastContainer />
    <div className="detalles-overlay" onClick={closeModal}></div>
    <div className="detalles-modal" style={getModalStyle()}>
      <div className="detalles-modal-content">
        <span className="detalles-close" onClick={closeModal}>&times;</span>
        <h2
          onClick={() => {
            setRecommendationField("all");
            setRecommendationValues({
              clientName: order.clientName,
              clientPhone: order.clientPhone,
              clientAddress: order.clientAddress,
              clientBarrio: order.clientBarrio,
            });
            setShowRecommendationModal(true);
          }}
          style={{ cursor: "pointer", color: "#ffffff" }}
        >
          Detalles del Pedido
        </h2>
        <div className="detalles-content">
          <h3>Información del Cliente:</h3>
          <p>
            <strong>Nombre:</strong> {order.clientName}
          </p>
          <p>
            <strong>Número del Pedido:</strong> {orderId}
          </p>
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
          <p>
            <strong>Barrio:</strong> {order.clientBarrio}
          </p>
          <p>
            <strong>Método de Pago:</strong>{" "}
            {incorrectPayment ? paymentMethod : order.paymentMethod}
          </p>
          <p>
            <strong>Total:</strong> {formatPrice(order.total)}
          </p>

          {/* Selección de método de pago si fue incorrecto */}
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

          {/* Pago parcial */}
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

          {/* Productos */}
          <h3>Productos:</h3>
          {groupProducts(order.cart).map((product, index) => (
            <div key={index}>
              <span>
                <strong>{product.quantity}X</strong>
                {product.name}
              </span>
              <ul>
                {product.ingredients.map((ingredient) => (
                  <li key={ingredient}>Sin {ingredient}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* --- Botón ENTREGADO --- */}
        <button
          className="detalles-button"
          onClick={handleEntregado}
          disabled={isProcessing || !connectionStatus.good}
        >
          {isProcessing ? "Procesando..." : "ENTREGADO"}
        </button>
      </div>
    </div>

    {/* Modal para recomendaciones */}
    {showRecommendationModal && (
      <div className="recomendacion-modal-overlay">
        <div className="recomendacion-modal">
          <span
            className="detalles-close"
            onClick={() => setShowRecommendationModal(false)}
          >
            &times;
          </span>
          <h3>Recomendar cambio de información</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRecommend();
            }}
          >
            {(recommendationField === "all" ||
              recommendationField === "clientName") && (
              <div>
                <label>Nuevo nombre:</label>
                <input
                  type="text"
                  name="clientName"
                  value={recommendationValues.clientName}
                  onChange={handleRecommendationChange}
                />
              </div>
            )}
            {(recommendationField === "all" ||
              recommendationField === "clientPhone") && (
              <div>
                <label>Nuevo teléfono:</label>
                <input
                  type="text"
                  name="clientPhone"
                  value={recommendationValues.clientPhone}
                  onChange={handleRecommendationChange}
                />
              </div>
            )}
            {(recommendationField === "all" ||
              recommendationField === "clientAddress") && (
              <div>
                <label>Nueva dirección:</label>
                <input
                  type="text"
                  name="clientAddress"
                  value={recommendationValues.clientAddress}
                  onChange={handleRecommendationChange}
                />
              </div>
            )}
            {(recommendationField === "all" ||
              recommendationField === "clientBarrio") && (
              <div>
                <label>Nuevo barrio:</label>
                <input
                  type="text"
                  name="clientBarrio"
                  value={recommendationValues.clientBarrio}
                  onChange={handleRecommendationChange}
                />
              </div>
            )}
            <button type="submit" className="detalles-button">
              Recomendar
            </button>
          </form>
        </div>
      </div>
    )}

    {/* Modal emergente de conexión */}
    {!connectionStatus.good && (
      <div className="detalles-overlay" style={{ zIndex: 3000, backdropFilter: "blur(5px)" }}>
        <div
          className="detalles-modal"
          style={{
            background: "#222",
            color: "#fff",
            textAlign: "center",
            maxWidth: "350px",
            zIndex: 3001,
            boxShadow: "0 0 20px #000",
          }}
        >
          <div className="container" style={{ marginBottom: "20px" }}>
            <div className="wl1 offline"></div>
            <div className="wl2"></div>
            <div className="wl3"></div>
            <div className="wl4"></div>
          </div>
          <h2 style={{ color: "#fa2c57" }}>Conexión inestable</h2>
          <p>⚠️ Espera a que tu conexión mejore para continuar.<br />Este mensaje desaparecerá automáticamente.</p>
        </div>
      </div>
    )}
  </div>
);

};

export default Detalles;
