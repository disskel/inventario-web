import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";

function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(null);

  // Datos Maestros
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);
  
  // Formulario Producto
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidad, setUnidad] = useState("");
  const [idEditar, setIdEditar] = useState(null);

  // Kardex Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [prodKardex, setProdKardex] = useState(null);
  const [tipoKardex, setTipoKardex] = useState("");
  const [cantidadKardex, setCantidadKardex] = useState("");

  // Filtros Principal
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("");

  // --- ESTADOS DE HISTORIAL AVANZADO ---
  const [verHistorial, setVerHistorial] = useState(false);
  const [listaMovimientos, setListaMovimientos] = useState([]);
  // Paginación y Filtros
  const [historialPagina, setHistorialPagina] = useState(1);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const ITEMS_POR_PAGINA = 10;

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

  // --- 3. LÓGICA DE HISTORIAL (CORREGIDA CON ZONA HORARIA) ---
  async function cargarHistorial(pagina = 1) {
    const desde = (pagina - 1) * ITEMS_POR_PAGINA;
    const hasta = desde + ITEMS_POR_PAGINA - 1;

    let query = supabase
      .from("movimientos")
      .select("*, productos(nombre)", { count: "exact" })
      .order("fecha_movimiento", { ascending: false })
      .range(desde, hasta);

    // FIX ZONA HORARIA: Convertimos tu hora local a UTC para la base de datos
    if (fechaInicio) {
      // Creamos la fecha local a las 00:00:00
      const fechaLocalInicio = new Date(`${fechaInicio}T00:00:00`);
      // Le enviamos a Supabase el equivalente en UTC
      query = query.gte("fecha_movimiento", fechaLocalInicio.toISOString());
    }
    
    if (fechaFin) {
      // Creamos la fecha local a las 23:59:59.999
      const fechaLocalFin = new Date(`${fechaFin}T23:59:59.999`);
      // Le enviamos a Supabase el equivalente en UTC
      query = query.lte("fecha_movimiento", fechaLocalFin.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      alert("Error cargando historial");
    } else {
      setListaMovimientos(data);
      setHistorialPagina(pagina);
    }
  }

  // Al abrir el modal, cargamos la página 1 sin filtros (o con los que haya)
  function abrirModalHistorial() {
    setVerHistorial(true);
    setHistorialPagina(1);
    cargarHistorial(1);
  }

  // --- 4. LÓGICA DE FILTRADO PRINCIPAL ---
  const productosFiltrados = productos.filter((prod) => {
    const coincideTexto = prod.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCat = filtroCategoria ? prod.categoria_id == filtroCategoria : true;
    const coincideUni = filtroUnidad ? prod.unidad_medida_id == filtroUnidad : true;
    return coincideTexto && coincideCat && coincideUni;
  });

  // --- 5. LÓGICA DE KARDEX (MOVIMIENTOS) ---
  function abrirModalKardex(producto, tipo) {
    setProdKardex(producto);
    setTipoKardex(tipo);
    setCantidadKardex("");
    setModalVisible(true);
  }

  async function confirmarMovimiento(e) {
    e.preventDefault();
    const esSoloNumeros = /^\d+$/.test(cantidadKardex);
    if (!esSoloNumeros) { alert("⚠️ Error: Escribe SOLO números enteros."); return; }
    
    const cantidad = parseInt(cantidadKardex);
    if (cantidad <= 0) { alert("⚠️ La cantidad debe ser mayor a 0."); return; }

    let nuevoStock = prodKardex.stock_actual;
    if (tipoKardex === "ENTRADA") {
      nuevoStock = nuevoStock + cantidad;
    } else {
      if (cantidad > prodKardex.stock_actual) { alert(`⚠️ Stock insuficiente.`); return; }
      nuevoStock = nuevoStock - cantidad;
    }

    const { error: errorHist } = await supabase.from("movimientos").insert({
      producto_id: prodKardex.id,
      tipo_movimiento: tipoKardex,
      cantidad: cantidad,
      usuario_id: session.user.id
    });

    if (errorHist) { alert("Error: " + errorHist.message); return; }

    const { error: errorProd } = await supabase.from("productos").update({ stock_actual: nuevoStock }).eq("id", prodKardex.id);

    if (!errorProd) {
      setModalVisible(false);
      fetchDatos();
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }

  // --- 6. CRUD PRODUCTOS ---
  async function manejarEnvio(e) {
    e.preventDefault();
    if (!nombre || !precio || !categoria) { alert("Faltan datos"); return; }
    
    const payload = { nombre, precio_venta: precio, categoria_id: categoria, unidad_medida_id: unidad };
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
    else { cancelarEdicion(); fetchDatos(); }
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
  const cardStyle = { background: "#1e1e1e", padding: "15px", marginBottom: "15px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.3)", border: "1px solid #333" };
  const inputStyle = { padding: "12px", margin: "5px 0", width: "100%", borderRadius: "8px", border: "1px solid #333", background: "#2c2c2c", color: "white", fontSize: "16px", boxSizing: "border-box" };
  const btnStyle = { padding: "12px", width: "100%", fontWeight: "bold", borderRadius: "8px", border: "none", cursor: "pointer", marginTop: "10px", fontSize: "16px" };
  const btnKardex = { padding: "10px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", color: "white", flex: 1 };
  const overlayStyle = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.9)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
  const modalBoxStyle = { background: "#252525", padding: "20px", borderRadius: "15px", width: "95%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto", border: "1px solid #444" };

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
      {/* CABECERA */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px"}}>
        <h2 style={{margin:0}}>📦 Mi Bodega</h2>
        <div style={{display:"flex", gap:"10px"}}>
          <button onClick={abrirModalHistorial} style={{padding:"8px 12px", background:"#0288d1", color:"white", border:"none", borderRadius:"8px", cursor:"pointer"}}>
            📜 Historial
          </button>
          <button onClick={handleLogout} style={{padding:"8px 12px", background:"#d32f2f", color:"white", border:"none", borderRadius:"8px", cursor:"pointer"}}>
            Salir
          </button>
        </div>
      </div>
      
      {/* FORMULARIO */}
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

      {/* FILTROS */}
      <div style={{ marginBottom: "20px", paddingBottom: "10px", borderBottom: "1px solid #333" }}>
        <h3 style={{margin:"0 0 10px 0", fontSize:"1.1em"}}>🔍 Buscar y Filtrar</h3>
        <input type="text" placeholder="🔎 Buscar por nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{...inputStyle, marginBottom:"10px", background: "#000", border:"1px solid #444"}} />
        <div style={{ display: "flex", gap: "10px" }}>
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={{...inputStyle, background: "#000", border:"1px solid #444"}}>
            <option value="">Todas las Categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={filtroUnidad} onChange={(e) => setFiltroUnidad(e.target.value)} style={{...inputStyle, background: "#000", border:"1px solid #444"}}>
            <option value="">Todas las Medidas</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* LISTADO */}
      <div style={{marginBottom: "10px", color: "#888", fontSize:"0.9em"}}>Mostrando {productosFiltrados.length} productos</div>
      {productosFiltrados.map((prod) => (
        <div key={prod.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom:"10px", borderBottom:"1px solid #333", paddingBottom:"10px" }}>
            <div>
              <h3 style={{ margin: "0 0 5px 0", fontSize:"1.3em", color:"white" }}>{prod.nombre}</h3>
              <div style={{ fontSize: "0.9em", color: "#aaa" }}>
                📂 {prod.categorias?.nombre || "Sin Categoría"} <br/>
                📏 {prod.unidades_medida?.nombre || "Unidad Estándar"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize:"1.4em", fontWeight:"bold", color:"#4caf50" }}>S/ {prod.precio_venta}</div>
              <div style={{ marginTop: "5px" }}>
                <button onClick={() => cargarDatosParaEditar(prod)} style={{background:"#444", border:"none", cursor:"pointer", fontSize:"1em", padding:"5px 10px", borderRadius:"5px", marginRight:"5px"}}>✏️</button>
                <button onClick={() => eliminarProducto(prod.id)} style={{background:"#d32f2f", border:"none", cursor:"pointer", fontSize:"1em", padding:"5px 10px", borderRadius:"5px"}}>🗑️</button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <button onClick={() => abrirModalKardex(prod, 'SALIDA')} style={{...btnKardex, background: "#ef5350"}}>- SALIDA</button>
            <div style={{ textAlign: "center", minWidth: "70px" }}>
              <div style={{ fontSize: "0.75em", color: "#888", fontWeight:"bold" }}>STOCK</div>
              <div style={{ fontSize: "1.6em", fontWeight: "bold", color: "white" }}>{prod.stock_actual}</div>
            </div>
            <button onClick={() => abrirModalKardex(prod, 'ENTRADA')} style={{...btnKardex, background: "#66bb6a"}}>+ ENTRADA</button>
          </div>
        </div>
      ))}

      {/* MODAL KARDEX */}
      {modalVisible && (
        <div style={overlayStyle}>
          <div style={{...modalBoxStyle, maxWidth: "350px", textAlign: "center"}}>
            <h2 style={{marginTop: 0, color: tipoKardex === "ENTRADA" ? "#66bb6a" : "#ef5350"}}>
              {tipoKardex === "ENTRADA" ? "📥 Registrar Entrada" : "📤 Registrar Salida"}
            </h2>
            <p style={{color: "#e0e0e0", marginBottom: "15px", fontSize:"1.1em"}}>Producto: <strong>{prodKardex?.nombre}</strong></p>
            <form onSubmit={confirmarMovimiento}>
              <input type="number" inputMode="numeric" autoFocus placeholder="Cantidad" value={cantidadKardex} onChange={(e) => setCantidadKardex(e.target.value)} style={{...inputStyle, fontSize: "24px", textAlign: "center", width: "120px", fontWeight:"bold", color: tipoKardex === "ENTRADA" ? "#66bb6a" : "#ef5350", border: `2px solid ${tipoKardex === "ENTRADA" ? "#66bb6a" : "#ef5350"}`}} />
              <div style={{display: "flex", gap: "10px", marginTop: "20px"}}>
                <button type="button" onClick={() => setModalVisible(false)} style={{...btnStyle, background: "#444", marginTop: 0}}>CANCELAR</button>
                <button type="submit" style={{...btnStyle, background: tipoKardex === "ENTRADA" ? "#66bb6a" : "#ef5350", marginTop: 0, color:"white"}}>CONFIRMAR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE HISTORIAL AVANZADO --- */}
      {verHistorial && (
        <div style={overlayStyle}>
          <div style={modalBoxStyle}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"15px"}}>
              <h2 style={{margin:0, color: "#0288d1"}}>📜 Historial</h2>
              <button onClick={() => setVerHistorial(false)} style={{background:"transparent", border:"none", color:"white", fontSize:"1.5em", cursor:"pointer"}}>✖️</button>
            </div>

            {/* BARRA DE FILTROS DE FECHA */}
            <div style={{background:"#333", padding:"10px", borderRadius:"8px", marginBottom:"15px", display:"flex", gap:"10px", flexDirection:"column"}}>
               <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                 <label style={{color:"#aaa", width:"50px"}}>Desde:</label>
                 <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={{...inputStyle, margin:0, padding:"8px"}} />
               </div>
               <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                 <label style={{color:"#aaa", width:"50px"}}>Hasta:</label>
                 <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={{...inputStyle, margin:0, padding:"8px"}} />
               </div>
               <button onClick={() => cargarHistorial(1)} style={{...btnStyle, background:"#555", marginTop:"5px", padding:"8px"}}>🔎 FILTRAR</button>
            </div>

            {/* TABLA */}
            {listaMovimientos.length === 0 ? (
               <p style={{textAlign:"center", color:"#aaa"}}>No hay movimientos.</p>
            ) : (
              <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.9em"}}>
                <thead>
                  <tr style={{borderBottom:"1px solid #555", color:"#aaa"}}>
                    <th style={{padding:"8px", textAlign:"left"}}>Detalle</th>
                    <th style={{padding:"8px", textAlign:"right"}}>Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {listaMovimientos.map((mov) => (
                    <tr key={mov.id} style={{borderBottom:"1px solid #333"}}>
                      <td style={{padding:"8px"}}>
                        <div style={{fontWeight:"bold", color:"white"}}>{mov.productos?.nombre || "Borrado"}</div>
                        <div style={{fontSize:"0.8em", color:"#888"}}>
                          {new Date(mov.fecha_movimiento).toLocaleDateString()} {new Date(mov.fecha_movimiento).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <span style={{
                          color: mov.tipo_movimiento === "ENTRADA" ? "#66bb6a" : "#ef5350",
                          fontSize: "0.8em", fontWeight: "bold"
                        }}>
                          {mov.tipo_movimiento}
                        </span>
                      </td>
                      <td style={{padding:"8px", textAlign:"right", fontWeight:"bold", fontSize:"1.2em", color:"white"}}>
                        {mov.cantidad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {/* PAGINACIÓN */}
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"20px", paddingTop:"10px", borderTop:"1px solid #444"}}>
                <button 
                  onClick={() => cargarHistorial(historialPagina - 1)} 
                  disabled={historialPagina === 1}
                  style={{background: historialPagina === 1 ? "#333" : "#0288d1", border:"none", color:"white", padding:"8px 15px", borderRadius:"5px", cursor: historialPagina === 1 ? "not-allowed" : "pointer"}}
                >
                  ⬅ Ant.
                </button>
                
                <span style={{color:"#aaa"}}>Página {historialPagina}</span>

                <button 
                  onClick={() => cargarHistorial(historialPagina + 1)}
                  disabled={listaMovimientos.length < ITEMS_POR_PAGINA} // Si trajo menos de 10, es la ultima pagina
                  style={{background: listaMovimientos.length < ITEMS_POR_PAGINA ? "#333" : "#0288d1", border:"none", color:"white", padding:"8px 15px", borderRadius:"5px", cursor: listaMovimientos.length < ITEMS_POR_PAGINA ? "not-allowed" : "pointer"}}
                >
                  Sig. ➡
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;