import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";

function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // Login States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(null);

  // Data States
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);
  
  // Form States (Crear/Editar)
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidad, setUnidad] = useState("");
  const [idEditar, setIdEditar] = useState(null);

  // --- NUEVOS ESTADOS PARA LA VENTANA FLOTANTE (MODAL) ---
  const [modalVisible, setModalVisible] = useState(false);
  const [prodKardex, setProdKardex] = useState(null); // Producto que estamos tocando
  const [tipoKardex, setTipoKardex] = useState("");   // "ENTRADA" o "SALIDA"
  const [cantidadKardex, setCantidadKardex] = useState(""); // Lo que escribe el usuario

  // --- 1. GESTIÓN DE SESIÓN ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
      if (session) fetchDatos();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchDatos();
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError("Credenciales incorrectas");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProductos([]);
  };

  // --- 2. GESTIÓN DE DATOS ---
  async function fetchDatos() {
    const { data: prods } = await supabase
      .from("productos")
      .select("*, categorias(nombre), unidades_medida(nombre)")
      .order("id", { ascending: false });
    
    if (categorias.length === 0) {
      const { data: cats } = await supabase.from("categorias").select("*");
      if (cats) setCategorias(cats);
    }
    if (unidades.length === 0) {
      const { data: unis } = await supabase.from("unidades_medida").select("*");
      if (unis) setUnidades(unis);
    }
    if (prods) setProductos(prods);
  }

  // --- 3. LÓGICA DE KARDEX (MODAL + TRANSACCIÓN) ---

  // Paso A: Abrir la ventana flotante
  function abrirModalKardex(producto, tipo) {
    setProdKardex(producto);
    setTipoKardex(tipo);
    setCantidadKardex(""); // Limpiar input
    setModalVisible(true); // Mostrar ventana
  }

  // Paso B: Confirmar y Guardar (Sustituye al antiguo prompt)
  async function confirmarMovimiento(e) {
    e.preventDefault(); // Evita recarga

    // Validación Estricta
    const esSoloNumeros = /^\d+$/.test(cantidadKardex);
    if (!esSoloNumeros) {
      alert("⚠️ Error: Escribe SOLO números enteros.");
      return;
    }
    const cantidad = parseInt(cantidadKardex);
    if (cantidad <= 0) {
      alert("⚠️ La cantidad debe ser mayor a 0.");
      return;
    }

    // Cálculos
    let nuevoStock = prodKardex.stock_actual;
    if (tipoKardex === "ENTRADA") {
      nuevoStock = nuevoStock + cantidad;
    } else {
      if (cantidad > prodKardex.stock_actual) {
        alert(`⚠️ Stock insuficiente. Solo tienes ${prodKardex.stock_actual}.`);
        return;
      }
      nuevoStock = nuevoStock - cantidad;
    }

    // Guardar en Supabase
    const { error: errorHist } = await supabase.from("movimientos").insert({
      producto_id: prodKardex.id,
      tipo_movimiento: tipoKardex,
      cantidad: cantidad,
      usuario_id: session.user.id
    });

    if (errorHist) {
      alert("Error: " + errorHist.message);
      return;
    }

    const { error: errorProd } = await supabase
      .from("productos")
      .update({ stock_actual: nuevoStock })
      .eq("id", prodKardex.id);

    if (!errorProd) {
      setModalVisible(false); // CERRAR VENTANA
      fetchDatos();           // REFRESCAR LISTA
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }

  // --- 4. CRUD PRODUCTOS (Crear/Editar) ---
  async function manejarEnvio(e) {
    e.preventDefault();
    if (!nombre || !precio || !categoria) { alert("Faltan datos"); return; }
    
    const payload = { 
      nombre, precio_venta: precio, categoria_id: categoria, unidad_medida_id: unidad 
    };
    if (!idEditar) payload.stock_actual = stock;

    let error;
    if (idEditar) {
      const res = await supabase.from("productos").update(payload).eq("id", idEditar);
      error = res.error;
    } else {
      const res = await supabase.from("productos").insert(payload);
      error = res.error;
    }

    if (error) alert(error.message);
    else {
      cancelarEdicion();
      fetchDatos();
    }
  }

  function cargarDatosParaEditar(p) {
    setNombre(p.nombre); setPrecio(p.precio_venta); setStock(p.stock_actual);
    setCategoria(p.categoria_id); setUnidad(p.unidad_medida_id); setIdEditar(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function eliminarProducto(id) {
    if (confirm("¿Borrar permanentemente?")) {
      await supabase.from("productos").delete().eq("id", id);
      fetchDatos();
    }
  }

  function cancelarEdicion() {
    setNombre(""); setPrecio(""); setStock(""); setCategoria(""); setUnidad(""); setIdEditar(null);
  }

  // --- ESTILOS ---
  const containerStyle = { padding: "15px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto", background: "#121212", color: "#e0e0e0", minHeight: "100vh" };
  const cardStyle = { background: "#1e1e1e", padding: "15px", marginBottom: "15px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" };
  const inputStyle = { padding: "12px", margin: "5px 0", width: "100%", borderRadius: "8px", border: "1px solid #333", background: "#2c2c2c", color: "white", fontSize: "16px" };
  const btnStyle = { padding: "12px", width: "100%", fontWeight: "bold", borderRadius: "8px", border: "none", cursor: "pointer", marginTop: "10px", fontSize: "16px" };
  const btnKardex = { padding: "10px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", color: "white", flex: 1 };

  // Estilos del Modal (Ventana Flotante)
  const overlayStyle = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
  const modalBoxStyle = { background: "#252525", padding: "25px", borderRadius: "15px", width: "85%", maxWidth: "350px", textAlign: "center", border: "1px solid #444" };

  if (loadingSession) return <div style={{...containerStyle, textAlign:"center", paddingTop:"50px"}}>⏳ Cargando...</div>;

  if (!session) {
    return (
      <div style={{...containerStyle, display: "flex", flexDirection: "column", justifyContent: "center", height: "80vh"}}>
        <h1 style={{textAlign: "center", color: "#4caf50"}}>🔐 Inventario App</h1>
        <div style={{background: "#1e1e1e", padding: "25px", borderRadius: "15px"}}>
          <form onSubmit={handleLogin}>
            <label>Correo:</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle} />
            <label style={{marginTop: "10px", display:"block"}}>Contraseña:</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle} />
            {loginError && <p style={{color: "#ff6b6b", textAlign:"center"}}>{loginError}</p>}
            <button type="submit" style={{...btnStyle, background: "#4caf50", color: "white"}}>INGRESAR</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px"}}>
        <h2 style={{margin:0}}>📦 Mi Bodega</h2>
        <button onClick={handleLogout} style={{padding:"8px 12px", background:"#d32f2f", color:"white", border:"none", borderRadius:"8px"}}>Salir</button>
      </div>
      
      {/* FORMULARIO CREAR/EDITAR */}
      <div style={{ background: "#252525", padding: "15px", borderRadius: "12px", marginBottom: "20px", borderLeft: idEditar ? "4px solid #fbc02d" : "4px solid #2196f3" }}>
        <h3 style={{ marginTop: 0 }}>{idEditar ? "✏️ Editar Producto" : "➕ Crear Nuevo"}</h3>
        <form onSubmit={manejarEnvio}>
          <input type="text" placeholder="Nombre Producto" value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
          <div style={{ display: "flex", gap: "10px" }}>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle}>
              <option value="">-- Categoría --</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)} style={inputStyle}>
              <option value="">-- Unidad --</option>
              {unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <input type="number" placeholder="Precio S/" value={precio} onChange={(e) => setPrecio(e.target.value)} style={inputStyle} />
            {!idEditar && <input type="number" placeholder="Stock Inicial" value={stock} onChange={(e) => setStock(e.target.value)} style={inputStyle} />}
          </div>
          <button type="submit" style={{...btnStyle, background: idEditar ? "#fbc02d" : "#2196f3", color: idEditar ? "black" : "white"}}>
            {idEditar ? "GUARDAR CAMBIOS" : "CREAR PRODUCTO"}
          </button>
          {idEditar && <button type="button" onClick={cancelarEdicion} style={{...btnStyle, background:"#757575", color:"white", marginTop:"5px"}}>CANCELAR</button>}
        </form>
      </div>

      {/* LISTADO DE TARJETAS */}
      {productos.map((prod) => (
        <div key={prod.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom:"10px" }}>
            <div>
              <h3 style={{ margin: "0 0 5px 0", fontSize:"1.2em" }}>{prod.nombre}</h3>
              <div style={{ fontSize: "0.85em", color: "#aaa" }}>
                📂 {prod.categorias?.nombre} | 📏 {prod.unidades_medida?.abreviatura}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize:"1.3em", fontWeight:"bold", color:"#4caf50" }}>S/ {prod.precio_venta}</div>
              <div style={{ marginTop: "5px" }}>
                <button onClick={() => cargarDatosParaEditar(prod)} style={{background:"transparent", border:"none", cursor:"pointer", fontSize:"1.2em", padding:"0 5px"}}>✏️</button>
                <button onClick={() => eliminarProducto(prod.id)} style={{background:"transparent", border:"none", cursor:"pointer", fontSize:"1.2em", padding:"0 5px"}}>🗑️</button>
              </div>
            </div>
          </div>

          <div style={{ background: "#333", padding: "10px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            {/* OJO: Aquí llamamos a abrirModalKardex en vez de registrarMovimiento */}
            <button onClick={() => abrirModalKardex(prod, 'SALIDA')} style={{...btnKardex, background: "#ef5350"}}>- SALIDA</button>
            <div style={{ textAlign: "center", minWidth: "60px" }}>
              <div style={{ fontSize: "0.8em", color: "#aaa" }}>STOCK</div>
              <div style={{ fontSize: "1.4em", fontWeight: "bold", color: "white" }}>{prod.stock_actual}</div>
            </div>
            <button onClick={() => abrirModalKardex(prod, 'ENTRADA')} style={{...btnKardex, background: "#66bb6a"}}>+ ENTRADA</button>
          </div>
        </div>
      ))}

      {/* --- AQUÍ ESTÁ EL CÓDIGO DE LA VENTANA NUEVA (MODAL) --- */}
      {modalVisible && (
        <div style={overlayStyle}>
          <div style={modalBoxStyle}>
            {/* Título Dinámico */}
            <h2 style={{marginTop: 0, color: tipoKardex === "ENTRADA" ? "#66bb6a" : "#ef5350"}}>
              {tipoKardex === "ENTRADA" ? "📥 Registrar Entrada" : "📤 Registrar Salida"}
            </h2>
            <p style={{color: "#aaa", marginBottom: "15px"}}>
              Producto: <strong>{prodKardex?.nombre}</strong> <br/>
              <small>Stock actual: {prodKardex?.stock_actual}</small>
            </p>
            
            <form onSubmit={confirmarMovimiento}>
              {/* Input grande y numérico */}
              <input 
                type="number" 
                inputMode="numeric" // Truco para activar teclado numérico en celular
                autoFocus 
                placeholder="Cantidad"
                value={cantidadKardex}
                onChange={(e) => setCantidadKardex(e.target.value)}
                style={{...inputStyle, fontSize: "20px", textAlign: "center", width: "100px"}} 
              />
              
              <div style={{display: "flex", gap: "10px", marginTop: "15px"}}>
                <button type="button" onClick={() => setModalVisible(false)} style={{...btnStyle, background: "#555", marginTop: 0}}>
                  CANCELAR
                </button>
                <button type="submit" style={{...btnStyle, background: tipoKardex === "ENTRADA" ? "#66bb6a" : "#ef5350", marginTop: 0}}>
                  CONFIRMAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;