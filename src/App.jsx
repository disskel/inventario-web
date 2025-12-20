import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";

function App() {
  // --- ESTADOS (La memoria de la app) ---
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]); // Nueva lista para el desplegable
  const [unidades, setUnidades] = useState([]);   // Nueva lista para el desplegable

  // Variables del Formulario
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [nuevoStock, setNuevoStock] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(""); // ID de la categoria
  const [unidadSeleccionada, setUnidadSeleccionada] = useState("");       // ID de la unidad

  // --- CARGA INICIAL ---
  useEffect(() => {
    fetchDatos();
  }, []);

  async function fetchDatos() {
    // 1. Traemos los productos
    const { data: dataProductos } = await supabase
      .from("productos")
      .select("*, categorias(nombre), unidades_medida(nombre)") // Truco: Traer el nombre de la categoria tambien
      .order("id", { ascending: false });
    
    // 2. Traemos las categorías para el Select
    const { data: dataCategorias } = await supabase.from("categorias").select("*");
    
    // 3. Traemos las unidades para el Select
    const { data: dataUnidades } = await supabase.from("unidades_medida").select("*");

    if (dataProductos) setProductos(dataProductos);
    if (dataCategorias) setCategorias(dataCategorias);
    if (dataUnidades) setUnidades(dataUnidades);
  }

  // --- GUARDAR PRODUCTO ---
  async function crearProducto(e) {
    e.preventDefault();

    if (!nuevoNombre || !nuevoPrecio || !categoriaSeleccionada) {
      alert("Por favor llena nombre, precio y categoría.");
      return;
    }

    const { error } = await supabase
      .from("productos")
      .insert({
        nombre: nuevoNombre,
        precio_venta: nuevoPrecio,
        stock_actual: nuevoStock,
        categoria_id: categoriaSeleccionada,     // Aquí vinculamos la relación
        unidad_medida_id: unidadSeleccionada
      });

    if (error) {
      alert("Error: " + error.message);
    } else {
      // Limpiar formulario
      setNuevoNombre("");
      setNuevoPrecio("");
      setNuevoStock("");
      fetchDatos(); // Recargar la lista
    }
  }

  // --- ESTILOS ---
  const containerStyle = { padding: "20px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto", background: "#1a1a1a", color: "white", minHeight: "100vh" };
  const cardStyle = { background: "#333", padding: "15px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #444" };
  const inputStyle = { padding: "12px", margin: "5px 0", width: "100%", boxSizing: "border-box", borderRadius: "4px", border: "none", background: "#fff", color: "#000" };
  const selectStyle = { ...inputStyle, background: "#e0e0e0" }; // Un poco gris para diferenciar

  return (
    <div style={containerStyle}>
      <h1 style={{ textAlign: "center" }}>📦 Inventario Pro</h1>

      {/* --- FORMULARIO --- */}
      <div style={{ background: "#222", padding: "20px", borderRadius: "10px", marginBottom: "30px", border: "1px solid #007bff" }}>
        <h3 style={{ marginTop: 0 }}>➕ Nuevo Ingreso</h3>
        <form onSubmit={crearProducto}>
          
          {/* Nombre */}
          <input 
            type="text" placeholder="Nombre (Ej: Inka Kola)" 
            value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
            style={inputStyle}
          />

          {/* Selectores de Relación */}
          <div style={{ display: "flex", gap: "10px" }}>
            <select 
              value={categoriaSeleccionada} 
              onChange={(e) => setCategoriaSeleccionada(e.target.value)}
              style={selectStyle}
            >
              <option value="">-- Selecciona Categoría --</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>

            <select 
              value={unidadSeleccionada} 
              onChange={(e) => setUnidadSeleccionada(e.target.value)}
              style={selectStyle}
            >
              <option value="">-- Unidad --</option>
              {unidades.map(uni => (
                <option key={uni.id} value={uni.id}>{uni.nombre}</option>
              ))}
            </select>
          </div>

          {/* Precio y Stock */}
          <div style={{ display: "flex", gap: "10px" }}>
            <input 
              type="number" placeholder="Precio S/" 
              value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)}
              style={inputStyle}
            />
            <input 
              type="number" placeholder="Stock" 
              value={nuevoStock} onChange={(e) => setNuevoStock(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button type="submit" style={{ padding: "12px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", width: "100%", marginTop: "10px", fontWeight: "bold", cursor: "pointer" }}>
            GUARDAR
          </button>
        </form>
      </div>

      {/* --- LISTADO --- */}
      {productos.map((prod) => (
        <li key={prod.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>{prod.nombre}</h3>
            <span style={{ color: "#4caf50", fontWeight: "bold" }}>S/ {prod.precio_venta}</span>
          </div>
          
          <div style={{ fontSize: "0.85em", color: "#aaa", marginTop: "5px" }}>
            {/* Aquí mostramos el nombre de la categoría gracias a la relación */}
            📂 {prod.categorias?.nombre || "Sin Categoría"} | 
            📏 {prod.unidades_medida?.nombre || "N/A"} | 
            📦 Stock: {prod.stock_actual}
          </div>
        </li>
      ))}
    </div>
  );
}

export default App;