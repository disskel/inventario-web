import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";

function App() {
  // --- ESTADOS DE SESIÓN ---
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // --- ESTADOS DE LOGIN ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(null);

  // --- ESTADOS DEL INVENTARIO (Tu código anterior) ---
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);
  
  // Variables Formulario Inventario
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidad, setUnidad] = useState("");
  const [idEditar, setIdEditar] = useState(null);

  // 1. AL INICIAR: Verificamos si ya hay alguien logueado
  useEffect(() => {
    // Verificamos sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
      if (session) fetchDatos(); // Si ya estaba logueado, cargamos datos
    });

    // Escuchamos cambios (Login o Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchDatos();
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. FUNCIÓN: INICIAR SESIÓN
  async function handleLogin(e) {
    e.preventDefault();
    setLoginError(null);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) setLoginError("Error: Credenciales incorrectas");
  }

  // 3. FUNCIÓN: CERRAR SESIÓN
  async function handleLogout() {
    await supabase.auth.signOut();
    setProductos([]); // Limpiamos la pantalla por seguridad
  }

  // --- LÓGICA DEL INVENTARIO (Tu código anterior intacto) ---
  async function fetchDatos() {
    const { data: prods } = await supabase.from("productos").select("*, categorias(nombre), unidades_medida(nombre)").order("id", { ascending: false });
    const { data: cats } = await supabase.from("categorias").select("*");
    const { data: unis } = await supabase.from("unidades_medida").select("*");
    if (prods) setProductos(prods);
    if (cats) setCategorias(cats);
    if (unis) setUnidades(unis);
  }

  async function manejarEnvio(e) {
    e.preventDefault();
    if (!nombre || !precio || !categoria) { alert("Faltan datos"); return; }
    
    const payload = { nombre, precio_venta: precio, stock_actual: stock, categoria_id: categoria, unidad_medida_id: unidad };
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
      setNombre(""); setPrecio(""); setStock(""); setCategoria(""); setUnidad(""); setIdEditar(null);
      fetchDatos();
    }
  }

  function cargarDatosParaEditar(p) {
    setNombre(p.nombre); setPrecio(p.precio_venta); setStock(p.stock_actual);
    setCategoria(p.categoria_id); setUnidad(p.unidad_medida_id); setIdEditar(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function eliminarProducto(id) {
    if (confirm("¿Borrar producto?")) {
      await supabase.from("productos").delete().eq("id", id);
      fetchDatos();
    }
  }

  function cancelarEdicion() {
    setNombre(""); setPrecio(""); setStock(""); setCategoria(""); setUnidad(""); setIdEditar(null);
  }

  // --- ESTILOS ---
  const containerStyle = { padding: "20px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto", background: "#1a1a1a", color: "white", minHeight: "100vh" };
  const inputStyle = { padding: "12px", margin: "5px 0", width: "100%", boxSizing: "border-box", borderRadius: "4px", border: "none" };
  const btnStyle = { padding: "12px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", width: "100%", fontWeight: "bold", cursor: "pointer", marginTop: "10px" };

  // ------------------------------------------------------------------
  // RENDERIZADO CONDICIONAL (EL PORTERO)
  // ------------------------------------------------------------------

  if (loadingSession) return <div style={{...containerStyle, textAlign:"center"}}>⏳ Cargando sistema...</div>;

  // SI NO HAY SESIÓN --> MOSTRAMOS LOGIN
  if (!session) {
    return (
      <div style={{...containerStyle, display: "flex", flexDirection: "column", justifyContent: "center", height: "80vh"}}>
        <h1 style={{textAlign: "center"}}>🔒 Acceso Socios</h1>
        <div style={{background: "#333", padding: "20px", borderRadius: "10px"}}>
          <form onSubmit={handleLogin}>
            <label>Correo:</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle} placeholder="admin@empresa.com" />
            
            <label style={{marginTop: "10px", display:"block"}}>Contraseña:</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle} placeholder="******" />
            
            {loginError && <p style={{color: "#ff6b6b", textAlign:"center"}}>{loginError}</p>}
            
            <button type="submit" style={btnStyle}>INGRESAR AL SISTEMA</button>
          </form>
        </div>
      </div>
    );
  }

  // SI HAY SESIÓN --> MOSTRAMOS EL INVENTARIO (Tu App Original)
  return (
    <div style={containerStyle}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px"}}>
        <h1 style={{margin:0}}>📦 Inventario</h1>
        <button onClick={handleLogout} style={{padding:"5px 10px", background:"#d9534f", color:"white", border:"none", borderRadius:"4px"}}>Cerrar Sesión</button>
      </div>
      
      {/* FORMULARIO */}
      <div style={{ background: "#222", padding: "20px", borderRadius: "10px", marginBottom: "30px", border: idEditar ? "2px solid #f0ad4e" : "1px solid #007bff" }}>
        <h3 style={{ marginTop: 0 }}>{idEditar ? "✏️ Editando" : "➕ Nuevo"}</h3>
        <form onSubmit={manejarEnvio}>
          <input type="text" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
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
            <input type="number" placeholder="Precio" value={precio} onChange={(e) => setPrecio(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} style={inputStyle} />
          </div>
          <button type="submit" style={{...btnStyle, background: idEditar ? "#f0ad4e" : "#007bff"}}>
            {idEditar ? "ACTUALIZAR" : "GUARDAR"}
          </button>
          {idEditar && <button type="button" onClick={cancelarEdicion} style={{...btnStyle, background:"#666", marginTop:"5px"}}>CANCELAR</button>}
        </form>
      </div>

      {/* LISTADO */}
      {productos.map((prod) => (
        <li key={prod.id} style={{ background: "#333", padding: "15px", marginBottom: "10px", borderRadius: "8px", listStyle:"none" }}>
           <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ margin: "0 0 5px 0" }}>{prod.nombre}</h3>
              <small style={{color:"#ccc"}}>📂 {prod.categorias?.nombre} | 📦 {prod.stock_actual}</small>
            </div>
            <div style={{textAlign:"right"}}>
              <strong style={{color:"#4caf50", display:"block", marginBottom:"5px"}}>S/ {prod.precio_venta}</strong>
              <button onClick={() => cargarDatosParaEditar(prod)} style={{marginRight:"5px", cursor:"pointer"}}>✏️</button>
              <button onClick={() => eliminarProducto(prod.id)} style={{cursor:"pointer"}}>🗑️</button>
            </div>
          </div>
        </li>
      ))}
    </div>
  );
}

export default App;