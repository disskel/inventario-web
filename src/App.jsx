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
  
  // Form States
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState(""); // Solo lectura en edición
  const [categoria, setCategoria] = useState("");
  const [unidad, setUnidad] = useState("");
  const [idEditar, setIdEditar] = useState(null);

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
    
    // Cargamos catálogos solo si están vacíos
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

  // --- 3. LÓGICA DE KARDEX (MOVIMIENTOS) ---
  async function registrarMovimiento(producto, tipo) {
    // Preguntamos la cantidad
    const cantidadStr = prompt(`¿Cuántas unidades van a ${tipo === "ENTRADA" ? "ENTRAR" : "SALIR"}?`);
    if (!cantidadStr) return; // Si cancela, no hacemos nada

    const cantidad = parseInt(cantidadStr);
    if (isNaN(cantidad) || cantidad <= 0) {
      alert("Por favor ingresa un número válido mayor a 0");
      return;
    }

    // Calculamos nuevo stock
    let nuevoStock = producto.stock_actual;
    if (tipo === "ENTRADA") {
      nuevoStock = nuevoStock + cantidad;
    } else { // SALIDA
      if (cantidad > producto.stock_actual) {
        alert("¡No tienes suficiente stock para vender eso!");
        return;
      }
      nuevoStock = nuevoStock - cantidad;
    }

    // --- TRANSACCIÓN (Guardar en DB) ---
    // 1. Guardar en historial
    const { error: errorHistorial } = await supabase.from("movimientos").insert({
      producto_id: producto.id,
      tipo_movimiento: tipo,
      cantidad: cantidad,
      usuario_id: session.user.id
    });

    if (errorHistorial) {
      alert("Error guardando historial: " + errorHistorial.message);
      return;
    }

    // 2. Actualizar producto
    const { error: errorProd } = await supabase
      .from("productos")
      .update({ stock_actual: nuevoStock })
      .eq("id", producto.id);

    if (errorProd) {
      alert("Error actualizando stock: " + errorProd.message);
    } else {
      // Éxito: Actualizamos la lista visualmente
      fetchDatos();
      // Feedback visual (Vibración en celular si soportado)
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }

  // --- 4. CRUD PRODUCTOS ---
  async function manejarEnvio(e) {
    e.preventDefault();
    if (!nombre || !precio || !categoria) { alert("Faltan datos"); return; }
    
    // Si es nuevo, usamos el stock del formulario. Si editamos, ignoramos el stock (se usa Kardex)
    const payload = { 
      nombre, 
      precio_venta: precio, 
      categoria_id: categoria, 
      unidad_medida_id: unidad 
    };

    if (!idEditar) payload.stock_actual = stock; // Solo al crear asignamos stock inicial

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
    if (confirm("¿Borrar producto permanentemente?")) {
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
  const inputStyle = { padding: "12px", margin: "5px 0", width: "100%", borderRadius: "8px", border: "1px solid #333", background: "#2c2c2c", color: "white" };
  const btnStyle = { padding: "12px", width: "100%", fontWeight: "bold", borderRadius: "8px", border: "none", cursor: "pointer", marginTop: "10px" };
  const btnKardex = { padding: "8px 15px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", color: "white", flex: 1 };

  if (loadingSession) return <div style={{...containerStyle, textAlign:"center", paddingTop:"50px"}}>⏳ Cargando...</div>;

  // --- VISTA LOGIN ---
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

  // --- VISTA PRINCIPAL ---
  return (
    <div style={containerStyle}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px"}}>
        <h2 style={{margin:0}}>📦 Mi Bodega</h2>
        <button onClick={handleLogout} style={{padding:"8px 12px", background:"#d32f2f", color:"white", border:"none", borderRadius:"8px"}}>Salir</button>
      </div>
      
      {/* FORMULARIO (Colapsable visualmente) */}
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
            {/* El stock solo se puede poner manualmente al CREAR. Al editar se bloquea para obligar a usar Kardex */}
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
          {/* Cabecera Tarjeta */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom:"10px" }}>
            <div>
              <h3 style={{ margin: "0 0 5px 0", fontSize:"1.2em" }}>{prod.nombre}</h3>
              <div style={{ fontSize: "0.85em", color: "#aaa" }}>
                📂 {prod.categorias?.nombre} | 📏 {prod.unidades_medida?.abreviatura || "u."}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize:"1.3em", fontWeight:"bold", color:"#4caf50" }}>S/ {prod.precio_venta}</div>
              {/* Botones Pequeños de Gestión */}
              <div style={{ marginTop: "5px" }}>
                <button onClick={() => cargarDatosParaEditar(prod)} style={{background:"transparent", border:"none", cursor:"pointer", fontSize:"1.2em", padding:"0 5px"}}>✏️</button>
                <button onClick={() => eliminarProducto(prod.id)} style={{background:"transparent", border:"none", cursor:"pointer", fontSize:"1.2em", padding:"0 5px"}}>🗑️</button>
              </div>
            </div>
          </div>

          {/* ZONA KARDEX (STOCK) */}
          <div style={{ background: "#333", padding: "10px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            {/* Botón Salida */}
            <button onClick={() => registrarMovimiento(prod, 'SALIDA')} style={{...btnKardex, background: "#ef5350"}}>
              - SALIDA
            </button>
            
            {/* Visualizador Stock */}
            <div style={{ textAlign: "center", minWidth: "60px" }}>
              <div style={{ fontSize: "0.8em", color: "#aaa" }}>STOCK</div>
              <div style={{ fontSize: "1.4em", fontWeight: "bold", color: "white" }}>{prod.stock_actual}</div>
            </div>

            {/* Botón Entrada */}
            <button onClick={() => registrarMovimiento(prod, 'ENTRADA')} style={{...btnKardex, background: "#66bb6a"}}>
              + ENTRADA
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;