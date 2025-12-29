import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  // Modales
  const [modalVisible, setModalVisible] = useState(false);
  const [prodKardex, setProdKardex] = useState(null);
  const [tipoKardex, setTipoKardex] = useState("");
  const [cantidadKardex, setCantidadKardex] = useState("");

  // Configuración y Historial
  const [verConfig, setVerConfig] = useState(false);
  const [tabConfig, setTabConfig] = useState("CAT");
  const [inputMaestro, setInputMaestro] = useState("");

  const [verHistorial, setVerHistorial] = useState(false);
  const [listaMovimientos, setListaMovimientos] = useState([]);
  const [historialPagina, setHistorialPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // Reporte
  const [verReporte, setVerReporte] = useState(false);
  const [repFechaIni, setRepFechaIni] = useState("");
  const [repFechaFin, setRepFechaFin] = useState("");
  const [datosReporte, setDatosReporte] = useState([]);
  const [cargandoReporte, setCargandoReporte] = useState(false);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("");
  const ITEMS_POR_PAGINA = 10;

  // --- 1. SESIÓN ---
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

  // --- 2. DATOS ---
  async function fetchDatos() {
    const { data: prods } = await supabase.from("productos").select("*, categorias(nombre), unidades_medida(nombre)").order("id", { ascending: false });
    if (prods) setProductos(prods);
    const { data: cats } = await supabase.from("categorias").select("*").order("nombre", { ascending: true });
    if (cats) setCategorias(cats);
    const { data: unis } = await supabase.from("unidades_medida").select("*").order("nombre", { ascending: true });
    if (unis) setUnidades(unis);
  }

  // --- 3. CONFIGURACIÓN ---
  async function guardarMaestro(e) {
    e.preventDefault();
    if (!inputMaestro.trim()) return;
    const tabla = tabConfig === "CAT" ? "categorias" : "unidades_medida";
    const { error } = await supabase.from(tabla).insert({ nombre: inputMaestro });
    if (error) alert("Error: " + error.message);
    else { setInputMaestro(""); fetchDatos(); }
  }

  async function eliminarMaestro(id, nombre) {
    const columna = tabConfig === "CAT" ? "categoria_id" : "unidad_medida_id";
    const tabla = tabConfig === "CAT" ? "categorias" : "unidades_medida";
    const { count, error } = await supabase.from("productos").select("*", { count: "exact", head: true }).eq(columna, id);
    if (error) { alert("Error verificando uso"); return; }
    if (count > 0) { alert(`⚠️ No puedes eliminar "${nombre}" porque se usa en ${count} productos.`); return; }
    if (confirm(`¿Borrar "${nombre}"?`)) {
      await supabase.from(tabla).delete().eq("id", id);
      fetchDatos();
    }
  }

  // --- 4. HISTORIAL ---
  async function cargarHistorial(pagina = 1) {
    const desde = (pagina - 1) * ITEMS_POR_PAGINA;
    const hasta = desde + ITEMS_POR_PAGINA - 1;

    let query = supabase
      .from("movimientos")
      .select("*, productos(nombre)", { count: "exact" })
      .order("fecha_movimiento", { ascending: false })
      .range(desde, hasta);
    
    if (fechaInicio) query = query.gte("fecha_movimiento", new Date(`${fechaInicio}T00:00:00`).toISOString());
    if (fechaFin) query = query.lte("fecha_movimiento", new Date(`${fechaFin}T23:59:59.999`).toISOString());

    const { data, error, count } = await query; 

    if (error) {
      alert("Error cargando historial");
    } else {
      setListaMovimientos(data);
      setHistorialPagina(pagina);
      const paginasCalculadas = count === 0 ? 1 : Math.ceil(count / ITEMS_POR_PAGINA);
      setTotalPaginas(paginasCalculadas);
    }
  }

  function abrirModalHistorial() {
    setVerHistorial(true);
    setHistorialPagina(1);
    cargarHistorial(1);
  }

  // --- 5. REPORTE KARDEX ---
  async function generarReporte() {
    if (!repFechaIni || !repFechaFin) { alert("Por favor selecciona ambas fechas."); return; }
    setCargandoReporte(true);

    const fechaFinUTC = new Date(`${repFechaFin}T23:59:59.999`).toISOString();
    const fechaIniUTC = new Date(`${repFechaIni}T00:00:00`).toISOString();

    const { data: catalogoProductos, error: errorProd } = await supabase.from("productos").select("id, nombre");
    if (errorProd) { alert("Error cargando productos"); setCargandoReporte(false); return; }

    const { data: movimientos, error: errorMov } = await supabase
        .from("movimientos")
        .select("producto_id, tipo_movimiento, cantidad, fecha_movimiento, nombre_producto_historico")
        .lte("fecha_movimiento", fechaFinUTC);

    if (errorMov) { alert("Error generando reporte: " + errorMov.message); setCargandoReporte(false); return; }

    const reporteMap = {};
    catalogoProductos.forEach(prod => {
        reporteMap[prod.id] = { id: prod.id, nombre: prod.nombre, stockInicial: 0, entradas: 0, salidas: 0, stockFinal: 0 };
    });

    movimientos.forEach(mov => {
        let idProd = mov.producto_id;
        if (!idProd || !reporteMap[idProd]) {
            idProd = "BORRADO_" + (mov.nombre_producto_historico || "X");
            if (!reporteMap[idProd]) {
                reporteMap[idProd] = { id: idProd, nombre: (mov.nombre_producto_historico || "Producto Eliminado") + " (Eliminado)", stockInicial: 0, entradas: 0, salidas: 0, stockFinal: 0 };
            }
        }
        const cantidad = mov.cantidad;
        const esEntrada = mov.tipo_movimiento === "ENTRADA";

        if (mov.fecha_movimiento < fechaIniUTC) {
            if (esEntrada) reporteMap[idProd].stockInicial += cantidad;
            else reporteMap[idProd].stockInicial -= cantidad;
        } else {
            if (esEntrada) reporteMap[idProd].entradas += cantidad;
            else reporteMap[idProd].salidas += cantidad;
        }
    });

    const resultado = Object.values(reporteMap).map(item => {
        item.stockFinal = item.stockInicial + item.entradas - item.salidas;
        return item;
    });

    resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setDatosReporte(resultado);
    setCargandoReporte(false);
  }

  function exportarExcel() {
    if (datosReporte.length === 0) return;
    let csvContent = "\uFEFF"; 
    csvContent += "Producto;Stock Inicial;Entradas;Salidas;Stock Final\n"; 
    datosReporte.forEach(row => { csvContent += `"${row.nombre}";${row.stockInicial};${row.entradas};${row.salidas};${row.stockFinal}\n`; });
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Kardex_${repFechaIni}_al_${repFechaFin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportarPDF() {
    if (datosReporte.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Reporte de Kardex Físico", 14, 20);
    doc.setFontSize(12);
    doc.text(`Desde: ${repFechaIni}   Hasta: ${repFechaFin}`, 14, 30);
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 14, 36);
    const tableColumn = ["Producto", "Stock Ini.", "Entradas", "Salidas", "Stock Fin."];
    const tableRows = [];
    datosReporte.forEach(row => { tableRows.push([row.nombre, row.stockInicial, row.entradas, row.salidas, row.stockFinal]); });
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 45, theme: 'grid', styles: { fontSize: 10 }, headStyles: { fillColor: [123, 31, 162] } });
    doc.save(`Reporte_${repFechaIni}_${repFechaFin}.pdf`);
  }

  // --- 6. KARDEX ---
  function abrirModalKardex(producto, tipo) {
    setProdKardex(producto);
    setTipoKardex(tipo);
    setCantidadKardex("");
    setModalVisible(true);
  }

  async function confirmarMovimiento(e) {
    e.preventDefault();
    const esSoloNumeros = /^\d+$/.test(cantidadKardex);
    if (!esSoloNumeros) { alert("⚠️ Error: Solo números."); return; }
    const cantidad = parseInt(cantidadKardex);
    if (cantidad <= 0) { alert("⚠️ Cantidad debe ser mayor a 0."); return; }

    let nuevoStock = prodKardex.stock_actual;
    if (tipoKardex === "ENTRADA") nuevoStock += cantidad;
    else {
      if (cantidad > prodKardex.stock_actual) { alert(`⚠️ Stock insuficiente.`); return; }
      nuevoStock -= cantidad;
    }

    const { error: errorHist } = await supabase.from("movimientos").insert({
      producto_id: prodKardex.id,
      tipo_movimiento: tipoKardex,
      cantidad: cantidad,
      usuario_id: session.user.id,
      nombre_producto_historico: prodKardex.nombre,
      motivo: "Manual"
    });

    if (errorHist) { alert("Error: " + errorHist.message); return; }
    const { error: errorProd } = await supabase.from("productos").update({ stock_actual: nuevoStock }).eq("id", prodKardex.id);
    if (!errorProd) { setModalVisible(false); fetchDatos(); if (navigator.vibrate) navigator.vibrate(50); }
  }

  // --- 7. CRUD ---
  async function manejarEnvio(e) {
    e.preventDefault();
    if (!nombre || !precio || !categoria) { alert("Faltan datos"); return; }
    const payload = { nombre, precio_venta: precio, categoria_id: categoria, unidad_medida_id: unidad };
    if (!idEditar) payload.stock_actual = stock; 

    let error;
    let nuevoProductoId = null;

    if (idEditar) {
      const res = await supabase.from("productos").update(payload).eq("id", idEditar);
      error = res.error;
    } else {
      const res = await supabase.from("productos").insert(payload).select();
      error = res.error;
      if (res.data) nuevoProductoId = res.data[0].id;
    }

    if (error) { alert(error.message); } 
    else {
      if (!idEditar && stock > 0 && nuevoProductoId) {
         await supabase.from("movimientos").insert({
            producto_id: nuevoProductoId,
            tipo_movimiento: "ENTRADA",
            cantidad: stock,
            usuario_id: session.user.id,
            nombre_producto_historico: nombre,
            motivo: "Stock Inicial"
         });
      }
      cancelarEdicion(); fetchDatos();
    }
  }

  function cargarDatosParaEditar(p) {
    setNombre(p.nombre); setPrecio(p.precio_venta); setStock(p.stock_actual);
    setCategoria(p.categoria_id); setUnidad(p.unidad_medida_id); setIdEditar(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function eliminarProducto(id) {
    if (confirm("¿Borrar permanentemente?")) { await supabase.from("productos").delete().eq("id", id); fetchDatos(); }
  }

  function cancelarEdicion() {
    setNombre(""); setPrecio(""); setStock(""); setCategoria(""); setUnidad(""); setIdEditar(null);
  }

  const productosFiltrados = productos.filter((prod) => {
    const coincideTexto = prod.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCat = filtroCategoria ? prod.categoria_id == filtroCategoria : true;
    const coincideUni = filtroUnidad ? prod.unidad_medida_id == filtroUnidad : true;
    return coincideTexto && coincideCat && coincideUni;
  });

  // --- ESTILOS ---
  const containerStyle = { padding: "15px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto", background: "#121212", color: "#e0e0e0", minHeight: "100vh" };
  const cardStyle = { background: "#1e1e1e", padding: "15px", marginBottom: "15px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.3)", border: "1px solid #333" };
  const inputStyle = { padding: "12px", margin: "5px 0", width: "100%", borderRadius: "8px", border: "1px solid #333", background: "#2c2c2c", color: "white", fontSize: "16px", boxSizing: "border-box" };
  const btnStyle = { padding: "12px", width: "100%", fontWeight: "bold", borderRadius: "8px", border: "none", cursor: "pointer", marginTop: "10px", fontSize: "16px" };
  const btnKardex = { padding: "10px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", color: "white", flex: 1 };
  
  // Z-INDEX AUMENTADO A 10000 PARA EVITAR CONFLICTOS
  const overlayStyle = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.9)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000 };
  const modalBoxStyle = { background: "#252525", padding: "20px", borderRadius: "15px", width: "95%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto", border: "1px solid #444" };

  if (loadingSession) return <div style={{...containerStyle, textAlign:"center", paddingTop:"50px"}}>⏳ Cargando...</div>;
  
  if (!session) {
    return (
      <div style={{...containerStyle, display: "flex", flexDirection: "column", justifyContent: "center", height: "80vh"}}>
        <h1 style={{textAlign: "center", color: "#4caf50"}}>🔐 Inventario App</h1>
        <div style={{background: "#1e1e1e", padding: "25px", borderRadius: "15px"}}>
          <form onSubmit={handleLogin}>
            <label>Correo:</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle} placeholder="admin@empresa.com" />
            <label style={{marginTop: "10px", display:"block"}}>Contraseña:</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle} placeholder="******" />
            {loginError && <p style={{color: "#ff6b6b", textAlign:"center"}}>{loginError}</p>}
            <button type="submit" style={{...btnStyle, background: "#4caf50", color: "white"}}>INGRESAR AL SISTEMA</button>
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
        <div style={{display:"flex", gap:"5px"}}>
          <button onClick={() => setVerConfig(true)} style={{padding:"8px 12px", background:"#555", color:"white", border:"none", borderRadius:"8px"}}>⚙️</button>
          <button onClick={() => setVerReporte(true)} style={{padding:"8px 12px", background:"#7b1fa2", color:"white", border:"none", borderRadius:"8px", cursor:"pointer"}}>📊</button>
          <button onClick={abrirModalHistorial} style={{padding:"8px 12px", background:"#0288d1", color:"white", border:"none", borderRadius:"8px"}}>📜</button>
          <button onClick={handleLogout} style={{padding:"8px 12px", background:"#d32f2f", color:"white", border:"none", borderRadius:"8px"}}>Salir</button>
        </div>
      </div>
      
      {/* FORMULARIO */}
      <div style={{ background: "#252525", padding: "15px", borderRadius: "12px", marginBottom: "20px", borderLeft: idEditar ? "4px solid #fbc02d" : "4px solid #2196f3" }}>
        <h3 style={{ marginTop: 0 }}>{idEditar ? "✏️ Editar" : "➕ Nuevo Producto"}</h3>
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
            <input type="number" placeholder="Precio S/" value={precio} onChange={(e) => setPrecio(e.target.value)} style={inputStyle} />
            {!idEditar && <input type="number" placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} style={inputStyle} />}
          </div>
          <button type="submit" style={{...btnStyle, background: idEditar ? "#fbc02d" : "#2196f3", color: idEditar ? "black" : "white"}}>{idEditar ? "GUARDAR" : "CREAR"}</button>
          {idEditar && <button type="button" onClick={cancelarEdicion} style={{...btnStyle, background:"#757575", color:"white", marginTop:"5px"}}>CANCELAR</button>}
        </form>
      </div>

      {/* FILTROS Y LISTA */}
      <div style={{ marginBottom: "20px", paddingBottom: "10px", borderBottom: "1px solid #333" }}>
        <input type="text" placeholder="🔎 Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{...inputStyle, marginBottom:"10px", background: "#000", border:"1px solid #444"}} />
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
      
      <div style={{marginBottom: "10px", color: "#888", fontSize:"0.9em"}}>Mostrando {productosFiltrados.length} productos</div>
      {productosFiltrados.map((prod) => (
        <div key={prod.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom:"10px", borderBottom:"1px solid #333", paddingBottom:"10px" }}>
            <div>
              <h3 style={{ margin: "0 0 5px 0", fontSize:"1.3em", color:"white" }}>{prod.nombre}</h3>
              <div style={{ fontSize: "0.9em", color: "#aaa" }}>📂 {prod.categorias?.nombre} | 📏 {prod.unidades_medida?.nombre}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize:"1.4em", fontWeight:"bold", color:"#4caf50" }}>S/ {prod.precio_venta}</div>
              <div style={{ marginTop: "5px" }}>
                 <button onClick={() => cargarDatosParaEditar(prod)} style={{background:"#444", border:"none", cursor:"pointer", padding:"5px 10px", borderRadius:"5px", marginRight:"5px"}}>✏️</button>
                 <button onClick={() => eliminarProducto(prod.id)} style={{background:"#d32f2f", border:"none", cursor:"pointer", padding:"5px 10px", borderRadius:"5px"}}>🗑️</button>
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

      {/* --- MODAL REPORTE GERENCIAL --- */}
      {verReporte && (
        <div style={overlayStyle}>
          <div style={{...modalBoxStyle, width: "95%", maxWidth: "800px"}}>
             <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"15px"}}>
              <h2 style={{margin:0, color: "#7b1fa2"}}>📊 Reporte Kardex</h2>
              <button onClick={() => setVerReporte(false)} style={{background:"transparent", border:"none", color:"white", fontSize:"1.5em", cursor:"pointer"}}>✖️</button>
            </div>

            <div style={{background:"#333", padding:"15px", borderRadius:"8px", marginBottom:"15px", display:"flex", flexWrap:"wrap", gap:"15px", alignItems:"flex-end"}}>
               <div style={{flex:1}}>
                 <label style={{color:"#aaa", display:"block", marginBottom:"5px"}}>Fecha Inicio:</label>
                 <input type="date" value={repFechaIni} onChange={e => setRepFechaIni(e.target.value)} style={{...inputStyle, margin:0, padding:"8px"}} />
               </div>
               <div style={{flex:1}}>
                 <label style={{color:"#aaa", display:"block", marginBottom:"5px"}}>Fecha Fin:</label>
                 <input type="date" value={repFechaFin} onChange={e => setRepFechaFin(e.target.value)} style={{...inputStyle, margin:0, padding:"8px"}} />
               </div>
               <button onClick={generarReporte} disabled={cargandoReporte} style={{...btnStyle, width:"auto", background:"#7b1fa2", marginTop:0, padding:"10px 20px"}}>
                 {cargandoReporte ? "Calculando..." : "GENERAR"}
               </button>
               
               {datosReporte.length > 0 && (
                   <div style={{display:"flex", gap:"5px"}}>
                        <button onClick={exportarExcel} style={{...btnStyle, width:"auto", background:"#2e7d32", marginTop:0, padding:"10px 15px"}}>
                            📥 EXCEL
                        </button>
                        <button onClick={exportarPDF} style={{...btnStyle, width:"auto", background:"#d32f2f", marginTop:0, padding:"10px 15px"}}>
                            📄 PDF
                        </button>
                   </div>
               )}
            </div>

            <div style={{overflowX: "auto"}}>
                {datosReporte.length === 0 ? (
                    <p style={{textAlign:"center", color:"#666"}}>Selecciona un rango y dale a Generar.</p>
                ) : (
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.9em", minWidth:"600px"}}>
                        <thead style={{background:"#444", color:"white"}}>
                            <tr>
                                <th style={{padding:"10px", textAlign:"left"}}>Producto</th>
                                <th style={{padding:"10px", textAlign:"center"}}>Stock Inicial</th>
                                <th style={{padding:"10px", textAlign:"center", color:"#66bb6a"}}>Entradas</th>
                                <th style={{padding:"10px", textAlign:"center", color:"#ef5350"}}>Salidas</th>
                                <th style={{padding:"10px", textAlign:"center", fontWeight:"bold"}}>Stock Final</th>
                            </tr>
                        </thead>
                        <tbody>
                            {datosReporte.map((row) => (
                                <tr key={row.id} style={{borderBottom:"1px solid #333"}}>
                                    <td style={{padding:"10px"}}>{row.nombre}</td>
                                    <td style={{padding:"10px", textAlign:"center", color:"#aaa"}}>{row.stockInicial}</td>
                                    <td style={{padding:"10px", textAlign:"center", color:"#66bb6a", fontWeight:"bold"}}>{row.entradas}</td>
                                    <td style={{padding:"10px", textAlign:"center", color:"#ef5350", fontWeight:"bold"}}>{row.salidas}</td>
                                    <td style={{padding:"10px", textAlign:"center", color:"white", fontWeight:"bold", fontSize:"1.1em"}}>{row.stockFinal}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIG */}
      {verConfig && (
        <div style={overlayStyle}>
           <div style={modalBoxStyle}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px"}}>
                 <h2 style={{margin:0, color: "#fff"}}>⚙️ Configuración</h2>
                 <button onClick={() => setVerConfig(false)} style={{background:"transparent", border:"none", color:"white", fontSize:"1.5em", cursor:"pointer"}}>✖️</button>
              </div>
              <div style={{display:"flex", gap:"10px", marginBottom:"20px"}}>
                 <button onClick={() => setTabConfig("CAT")} style={{flex:1, padding:"10px", background: tabConfig==="CAT" ? "#007bff" : "#333", color:"white", border:"none", borderRadius:"8px", cursor:"pointer"}}>Categorías</button>
                 <button onClick={() => setTabConfig("UNI")} style={{flex:1, padding:"10px", background: tabConfig==="UNI" ? "#007bff" : "#333", color:"white", border:"none", borderRadius:"8px", cursor:"pointer"}}>Unidades</button>
              </div>
              <form onSubmit={guardarMaestro} style={{display:"flex", gap:"10px", marginBottom:"20px"}}>
                 <input type="text" placeholder={tabConfig==="CAT" ? "Nueva Categoría..." : "Nueva Unidad..."} value={inputMaestro} onChange={(e) => setInputMaestro(e.target.value)} style={{...inputStyle, margin:0}} />
                 <button type="submit" style={{background:"#28a745", color:"white", border:"none", borderRadius:"8px", padding:"0 20px", fontWeight:"bold", cursor:"pointer"}}>AGREGAR</button>
              </form>
              <div style={{maxHeight:"300px", overflowY:"auto", border:"1px solid #444", borderRadius:"8px"}}>
                 {(tabConfig === "CAT" ? categorias : unidades).map(item => (
                    <div key={item.id} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px", borderBottom:"1px solid #333", background:"#1a1a1a"}}>
                       <span style={{color:"white"}}>{item.nombre}</span>
                       <button onClick={() => eliminarMaestro(item.id, item.nombre)} style={{background:"#d32f2f", color:"white", border:"none", borderRadius:"5px", padding:"5px 10px", cursor:"pointer"}}>🗑️</button>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* MODAL HISTORIAL */}
      {verHistorial && (
        <div style={overlayStyle}>
          <div style={modalBoxStyle}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"15px"}}>
              <h2 style={{margin:0, color: "#0288d1"}}>📜 Historial</h2>
              <button onClick={() => setVerHistorial(false)} style={{background:"transparent", border:"none", color:"white", fontSize:"1.5em", cursor:"pointer"}}>✖️</button>
            </div>
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

            {listaMovimientos.length === 0 ? <p style={{textAlign:"center", color:"#aaa"}}>No hay movimientos.</p> : (
              <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.9em"}}>
                <tbody>
                  {listaMovimientos.map((mov) => (
                    <tr key={mov.id} style={{borderBottom:"1px solid #333"}}>
                      <td style={{padding:"8px"}}>
                        <div style={{fontWeight:"bold", color:"white", display:"flex", alignItems:"center", gap:"5px"}}>
                           {mov.productos?.nombre || mov.nombre_producto_historico || "Desconocido"}
                           {!mov.productos && (
                             <span style={{fontSize:"0.7em", background:"#d32f2f", color:"white", padding:"1px 4px", borderRadius:"4px"}}>🗑️ Eliminado</span>
                           )}
                           {mov.motivo === "Stock Inicial" && (
                             <span style={{fontSize:"0.7em", background:"#0288d1", color:"white", padding:"1px 4px", borderRadius:"4px"}}>✨ Nuevo</span>
                           )}
                        </div>
                        <div style={{fontSize:"0.8em", color:"#888"}}>
                            {new Date(mov.fecha_movimiento).toLocaleDateString()} {new Date(mov.fecha_movimiento).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <div style={{marginTop:"2px"}}>
                            <span style={{color: mov.tipo_movimiento === "ENTRADA" ? "#66bb6a" : "#ef5350", fontSize: "0.8em", fontWeight: "bold", marginRight:"10px"}}>
                                {mov.tipo_movimiento}
                            </span>
                            {mov.motivo && mov.motivo !== "Manual" && (
                                <span style={{fontSize:"0.8em", color:"#aaa", fontStyle:"italic"}}>{mov.motivo}</span>
                            )}
                        </div>
                      </td>
                      <td style={{padding:"8px", textAlign:"right", fontWeight:"bold", fontSize:"1.2em", color:"white"}}>{mov.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"20px", paddingTop:"10px", borderTop:"1px solid #444"}}>
                <button onClick={() => cargarHistorial(historialPagina - 1)} disabled={historialPagina === 1} style={{background: historialPagina === 1 ? "#333" : "#0288d1", border:"none", color:"white", padding:"8px 15px", borderRadius:"5px", cursor: historialPagina === 1 ? "not-allowed" : "pointer"}}>⬅ Ant.</button>
                <span style={{color:"#aaa"}}>Página <strong>{historialPagina}</strong> de <strong>{totalPaginas}</strong></span>
                <button onClick={() => cargarHistorial(historialPagina + 1)} disabled={historialPagina >= totalPaginas} style={{background: historialPagina >= totalPaginas ? "#333" : "#0288d1", border:"none", color:"white", padding:"8px 15px", borderRadius:"5px", cursor: historialPagina >= totalPaginas ? "not-allowed" : "pointer"}}>Sig. ➡</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KARDEX (MOVIDO AL FINAL Y SIN AUTOFOCUS) */}
      {modalVisible && (
        <div style={overlayStyle}>
           <div style={{...modalBoxStyle, maxWidth: "350px", textAlign: "center"}}>
             <h2 style={{marginTop: 0, color: tipoKardex === "ENTRADA" ? "#66bb6a" : "#ef5350"}}>{tipoKardex === "ENTRADA" ? "📥 Registrar Entrada" : "📤 Registrar Salida"}</h2>
             <p style={{color: "#e0e0e0", marginBottom: "15px"}}>Producto: <strong>{prodKardex?.nombre}</strong></p>
             <form onSubmit={confirmarMovimiento}>
               {/* QUITAMOS AUTOFOCUS POR SI ACASO */}
               <input type="number" inputMode="numeric" placeholder="Cantidad" value={cantidadKardex} onChange={(e) => setCantidadKardex(e.target.value)} style={{...inputStyle, fontSize: "24px", textAlign: "center", width: "120px", fontWeight:"bold", color: tipoKardex === "ENTRADA" ? "#66bb6a" : "#ef5350", border: `2px solid ${tipoKardex === "ENTRADA" ? "#66bb6a" : "#ef5350"}`}} />
               <div style={{display: "flex", gap: "10px", marginTop: "20px"}}>
                 <button type="button" onClick={() => setModalVisible(false)} style={{...btnStyle, background: "#444", marginTop: 0}}>CANCELAR</button>
                 <button type="submit" style={{...btnStyle, background: tipoKardex === "ENTRADA" ? "#66bb6a" : "#ef5350", marginTop: 0, color:"white"}}>CONFIRMAR</button>
               </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;