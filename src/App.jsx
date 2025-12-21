import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";

function App() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);

  // Variables del Formulario
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidad, setUnidad] = useState("");

  // ESTADO NUEVO: ¿Estamos editando? (Guarda el ID del producto que editamos)
  const [idEditar, setIdEditar] = useState(null);

  useEffect(() => {
    fetchDatos();
  }, []);

  async function fetchDatos() {
    const { data: prods } = await supabase
      .from("productos")
      .select("*, categorias(nombre), unidades_medida(nombre)")
      .order("id", { ascending: false });
    const { data: cats } = await supabase.from("categorias").select("*");
    const { data: unis } = await supabase.from("unidades_medida").select("*");

    if (prods) setProductos(prods);
    if (cats) setCategorias(cats);
    if (unis) setUnidades(unis);
  }

  // --- FUNCIÓN 1: GUARDAR O ACTUALIZAR (Dual) ---
  async function manejarEnvio(e) {
    e.preventDefault();

    if (!nombre || !precio || !categoria) {
      alert("Faltan datos obligatorios");
      return;
    }

    const datosFormulario = {
      nombre: nombre,
      precio_venta: precio,
      stock_actual: stock,
      categoria_id: categoria,
      unidad_medida_id: unidad
    };

    let error;

    if (idEditar) {
      // MODO EDICIÓN: Usamos UPDATE
      const response = await supabase
        .from("productos")
        .update(datosFormulario)
        .eq("id", idEditar);
      error = response.error;
    } else {
      // MODO CREACIÓN: Usamos INSERT
      const response = await supabase
        .from("productos")
        .insert(datosFormulario);
      error = response.error;
    }

    if (error) {
      alert("Error: " + error.message);
    } else {
      // Limpiar todo
      setNombre(""); setPrecio(""); setStock(""); setCategoria(""); setUnidad("");
      setIdEditar(null); // Salir del modo edición
      fetchDatos();
    }
  }

  // --- FUNCIÓN 2: CARGAR DATOS PARA EDITAR ---
  function cargarDatosParaEditar(producto) {
    setNombre(producto.nombre);
    setPrecio(producto.precio_venta);
    setStock(producto.stock_actual);
    setCategoria(producto.categoria_id);
    setUnidad(producto.unidad_medida_id);
    setIdEditar(producto.id); // Activamos modo edición
    
    // Scrollear hacia arriba para ver el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- FUNCIÓN 3: ELIMINAR ---
  async function eliminarProducto(id) {
    if (window.confirm("¿Seguro que quieres borrar este producto?")) {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      
      if (error) {
        alert("No se pudo borrar: " + error.message);
      } else {
        fetchDatos();
      }
    }
  }

  // --- FUNCIÓN 4: CANCELAR EDICIÓN ---
  function cancelarEdicion() {
    setNombre(""); setPrecio(""); setStock(""); setCategoria(""); setUnidad("");
    setIdEditar(null);
  }

  // ESTILOS SIMPLES
  const containerStyle = { padding: "20px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto", background: "#1a1a1a", color: "white", minHeight: "100vh" };
  const cardStyle = { background: "#333", padding: "15px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #444", position: "relative" };
  const inputStyle = { padding: "12px", margin: "5px 0", width: "100%", boxSizing: "border-box", borderRadius: "4px", border: "none", background: "#fff", color: "#000" };
  const selectStyle = { ...inputStyle, background: "#e0e0e0" };
  const btnActionStyle = { padding: "5px 10px", marginLeft: "10px", cursor: "pointer", border: "none", borderRadius: "4px", fontWeight: "bold" };

  return (
    <div style={containerStyle}>
      <h1 style={{ textAlign: "center" }}>📦 Inventario Pro</h1>

      {/* --- FORMULARIO INTELIGENTE --- */}
      <div style={{ background: "#222", padding: "20px", borderRadius: "10px", marginBottom: "30px", border: idEditar ? "2px solid #f0ad4e" : "1px solid #007bff" }}>
        <h3 style={{ marginTop: 0 }}>
          {idEditar ? "✏️ Editando Producto" : "➕ Nuevo Ingreso"}
        </h3>
        
        <form onSubmit={manejarEnvio}>
          <input type="text" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
          
          <div style={{ display: "flex", gap: "10px" }}>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={selectStyle}>
              <option value="">-- Categoría --</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)} style={selectStyle}>
              <option value="">-- Unidad --</option>
              {unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <input type="number" placeholder="Precio S/" value={precio} onChange={(e) => setPrecio(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} style={inputStyle} />
          </div>

          <button type="submit" style={{ ...inputStyle, background: idEditar ? "#f0ad4e" : "#007bff", color: "white", fontWeight: "bold", cursor: "pointer", marginTop: "15px" }}>
            {idEditar ? "ACTUALIZAR PRODUCTO" : "GUARDAR PRODUCTO"}
          </button>

          {idEditar && (
            <button type="button" onClick={cancelarEdicion} style={{ ...inputStyle, background: "#666", color: "white", cursor: "pointer", marginTop: "5px" }}>
              CANCELAR EDICIÓN
            </button>
          )}
        </form>
      </div>

      {/* --- LISTADO CON BOTONES --- */}
      {productos.map((prod) => (
        <li key={prod.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div>
              <h3 style={{ margin: "0 0 5px 0" }}>{prod.nombre}</h3>
              <div style={{ fontSize: "0.85em", color: "#aaa" }}>
                📂 {prod.categorias?.nombre} | 📦 Stock: {prod.stock_actual}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: "#4caf50", fontWeight: "bold", display: "block", marginBottom: "10px" }}>S/ {prod.precio_venta}</span>
              
              {/* BOTONES DE ACCIÓN */}
              <button onClick={() => cargarDatosParaEditar(prod)} style={{ ...btnActionStyle, background: "#ffc107", color: "black" }}>✏️</button>
              <button onClick={() => eliminarProducto(prod.id)} style={{ ...btnActionStyle, background: "#ff4d4d", color: "white" }}>🗑️</button>
            </div>
          </div>
        </li>
      ))}
    </div>
  );
}

export default App;