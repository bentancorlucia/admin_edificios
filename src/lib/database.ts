import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;
let isInitialized = false;

// SQL para crear las tablas
const INIT_SQL = `
-- Tabla Apartamento
CREATE TABLE IF NOT EXISTS Apartamento (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    piso INTEGER,
    alicuota REAL DEFAULT 0,
    gastosComunes REAL DEFAULT 0,
    fondoReserva REAL DEFAULT 0,
    tipoOcupacion TEXT DEFAULT 'PROPIETARIO' CHECK (tipoOcupacion IN ('PROPIETARIO', 'INQUILINO')),
    contactoNombre TEXT,
    contactoApellido TEXT,
    contactoCelular TEXT,
    contactoEmail TEXT,
    notas TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(numero, tipoOcupacion)
);

-- Tabla Inquilino
CREATE TABLE IF NOT EXISTS Inquilino (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    cedula TEXT UNIQUE,
    email TEXT,
    telefono TEXT,
    tipo TEXT DEFAULT 'INQUILINO' CHECK (tipo IN ('PROPIETARIO', 'INQUILINO')),
    activo INTEGER DEFAULT 1,
    fechaIngreso TEXT DEFAULT (datetime('now')),
    fechaSalida TEXT,
    notas TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    apartamentoId TEXT,
    FOREIGN KEY (apartamentoId) REFERENCES Apartamento(id) ON DELETE SET NULL
);

-- Tabla CuentaBancaria (debe ir antes de MovimientoBancario)
CREATE TABLE IF NOT EXISTS CuentaBancaria (
    id TEXT PRIMARY KEY,
    banco TEXT NOT NULL,
    tipoCuenta TEXT NOT NULL,
    numeroCuenta TEXT NOT NULL,
    titular TEXT,
    saldoInicial REAL DEFAULT 0,
    activa INTEGER DEFAULT 1,
    porDefecto INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

-- Tabla TipoServicio (debe ir antes de Servicio)
CREATE TABLE IF NOT EXISTS TipoServicio (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    color TEXT DEFAULT 'default',
    orden INTEGER DEFAULT 0,
    activo INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

-- Tabla Servicio (debe ir antes de MovimientoBancario)
CREATE TABLE IF NOT EXISTS Servicio (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    celular TEXT,
    email TEXT,
    banco TEXT,
    numeroCuenta TEXT,
    observaciones TEXT,
    activo INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

-- Tabla Transaccion
CREATE TABLE IF NOT EXISTS Transaccion (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO', 'VENTA_CREDITO', 'RECIBO_PAGO')),
    monto REAL NOT NULL,
    fecha TEXT DEFAULT (datetime('now')),
    categoria TEXT CHECK (categoria IN ('GASTOS_COMUNES', 'FONDO_RESERVA', 'MANTENIMIENTO', 'SERVICIOS', 'ADMINISTRACION', 'REPARACIONES', 'LIMPIEZA', 'SEGURIDAD', 'OTROS')),
    descripcion TEXT,
    referencia TEXT,
    metodoPago TEXT DEFAULT 'EFECTIVO' CHECK (metodoPago IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE', 'OTRO')),
    notas TEXT,
    estadoCredito TEXT CHECK (estadoCredito IN ('PENDIENTE', 'PARCIAL', 'PAGADO')),
    montoPagado REAL DEFAULT 0,
    clasificacionPago TEXT CHECK (clasificacionPago IN ('GASTO_COMUN', 'FONDO_RESERVA', 'MIXTO')),
    montoGastoComun REAL,
    montoFondoReserva REAL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    apartamentoId TEXT,
    FOREIGN KEY (apartamentoId) REFERENCES Apartamento(id) ON DELETE SET NULL
);

-- Tabla MovimientoBancario
CREATE TABLE IF NOT EXISTS MovimientoBancario (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
    monto REAL NOT NULL,
    fecha TEXT DEFAULT (datetime('now')),
    descripcion TEXT NOT NULL,
    referencia TEXT,
    numeroDocumento TEXT,
    archivoUrl TEXT,
    clasificacion TEXT CHECK (clasificacion IN ('GASTO_COMUN', 'FONDO_RESERVA')),
    conciliado INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    cuentaBancariaId TEXT NOT NULL,
    transaccionId TEXT UNIQUE,
    servicioId TEXT,
    FOREIGN KEY (cuentaBancariaId) REFERENCES CuentaBancaria(id) ON DELETE CASCADE,
    FOREIGN KEY (transaccionId) REFERENCES Transaccion(id) ON DELETE SET NULL,
    FOREIGN KEY (servicioId) REFERENCES Servicio(id) ON DELETE SET NULL
);

-- Tabla Registro
CREATE TABLE IF NOT EXISTS Registro (
    id TEXT PRIMARY KEY,
    fecha TEXT DEFAULT (datetime('now')),
    tipo TEXT NOT NULL CHECK (tipo IN ('NOVEDAD', 'VENCIMIENTO', 'MANTENIMIENTO', 'REUNION', 'INCIDENTE', 'RECORDATORIO', 'OTRO')),
    detalle TEXT NOT NULL,
    observaciones TEXT,
    situacion TEXT DEFAULT 'PENDIENTE' CHECK (situacion IN ('PENDIENTE', 'EN_PROCESO', 'REALIZADO', 'CANCELADO', 'VENCIDO')),
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

-- Tabla AvisoInforme
CREATE TABLE IF NOT EXISTS AvisoInforme (
    id TEXT PRIMARY KEY,
    texto TEXT NOT NULL,
    orden INTEGER DEFAULT 0,
    mes INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    activo INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

-- Tabla ConfiguracionInforme
CREATE TABLE IF NOT EXISTS ConfiguracionInforme (
    id TEXT PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);
`;

// Índices SQL (separados para ejecutar uno por uno)
const INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_inquilino_apartamento ON Inquilino(apartamentoId)',
  'CREATE INDEX IF NOT EXISTS idx_transaccion_apartamento ON Transaccion(apartamentoId)',
  'CREATE INDEX IF NOT EXISTS idx_movimiento_cuenta ON MovimientoBancario(cuentaBancariaId)',
  'CREATE INDEX IF NOT EXISTS idx_movimiento_transaccion ON MovimientoBancario(transaccionId)',
  'CREATE INDEX IF NOT EXISTS idx_movimiento_servicio ON MovimientoBancario(servicioId)',
  'CREATE INDEX IF NOT EXISTS idx_aviso_mes_anio ON AvisoInforme(mes, anio)',
];

export async function initDatabase(): Promise<void> {
  if (isInitialized) return;

  const database = await getDatabase();

  // Ejecutar cada statement de creación de tabla por separado
  // Primero eliminar comentarios línea por línea, luego dividir por ;
  const sqlSinComentarios = INIT_SQL
    .split('\n')
    .map(line => line.trim())
    .filter(line => !line.startsWith('--'))
    .join('\n');

  const statements = sqlSinComentarios
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await database.execute(statement);
  }

  // Crear índices
  for (const indexSql of INDEX_SQL) {
    await database.execute(indexSql);
  }

  // Inicializar tipos de servicio predeterminados
  await initTiposServicioDefault();

  isInitialized = true;

  console.log('Base de datos inicializada correctamente');
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    // Intentar cargar la base de datos con reintentos
    let retries = 5;
    let lastError: Error | null = null;

    while (retries > 0) {
      try {
        console.log(`Intentando conectar a la base de datos (intento ${6 - retries}/5)...`);
        db = await Database.load('sqlite:database.db');
        // Activar claves foráneas en cada conexión (SQLite las desactiva por defecto)
        await db.execute('PRAGMA foreign_keys = ON');
        console.log('Conexión a la base de datos establecida correctamente');
        break;
      } catch (error) {
        lastError = error as Error;
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Error al conectar (intento ${6 - retries}/5):`, errorMsg);
        retries--;
        if (retries > 0) {
          // Esperar más tiempo entre reintentos para dar tiempo al plugin SQL
          const waitTime = (6 - retries) * 500; // 500ms, 1000ms, 1500ms, 2000ms
          console.log(`Esperando ${waitTime}ms antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    if (!db && lastError) {
      const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
      console.error('Error al cargar la base de datos después de varios intentos:', errorMsg);
      throw new Error(`No se pudo conectar a la base de datos: ${errorMsg}`);
    }

  }
  return db!;
}

// Función auxiliar para generar IDs únicos (similar a cuid)
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${randomPart}`;
}

// Función para formatear fecha actual
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// ============ APARTAMENTOS ============

export interface Apartamento {
  id: string;
  numero: string;
  piso: number | null;
  alicuota: number;
  gastosComunes: number;
  fondoReserva: number;
  tipoOcupacion: 'PROPIETARIO' | 'INQUILINO';
  contactoNombre: string | null;
  contactoApellido: string | null;
  contactoCelular: string | null;
  contactoEmail: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getApartamentos(): Promise<Apartamento[]> {
  const database = await getDatabase();
  return database.select<Apartamento[]>('SELECT * FROM Apartamento ORDER BY numero');
}

export async function getApartamentosOrdenados(): Promise<Apartamento[]> {
  const database = await getDatabase();
  return database.select<Apartamento[]>('SELECT * FROM Apartamento ORDER BY piso ASC, numero ASC');
}

export async function getApartamentoById(id: string): Promise<Apartamento | null> {
  const database = await getDatabase();
  const result = await database.select<Apartamento[]>('SELECT * FROM Apartamento WHERE id = ?', [id]);
  return result[0] || null;
}

export async function createApartamento(data: Omit<Apartamento, 'id' | 'createdAt' | 'updatedAt' | 'alicuota'>): Promise<Apartamento> {
  const database = await getDatabase();
  const id = generateId();
  const now = getCurrentTimestamp();

  await database.execute(
    `INSERT INTO Apartamento (id, numero, piso, alicuota, gastosComunes, fondoReserva, tipoOcupacion, contactoNombre, contactoApellido, contactoCelular, contactoEmail, notas, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.numero, data.piso, 0, data.gastosComunes, data.fondoReserva, data.tipoOcupacion, data.contactoNombre, data.contactoApellido, data.contactoCelular, data.contactoEmail, data.notas, now, now]
  );

  return (await getApartamentoById(id))!;
}

export async function updateApartamento(id: string, data: Partial<Omit<Apartamento, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Apartamento> {
  const database = await getDatabase();
  const now = getCurrentTimestamp();

  const fields: string[] = [];
  const values: unknown[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await database.execute(
    `UPDATE Apartamento SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return (await getApartamentoById(id))!;
}

export async function deleteApartamento(id: string): Promise<void> {
  const database = await getDatabase();
  await database.execute('DELETE FROM Apartamento WHERE id = ?', [id]);
}

// ============ TRANSACCIONES ============

export interface Transaccion {
  id: string;
  tipo: 'INGRESO' | 'EGRESO' | 'VENTA_CREDITO' | 'RECIBO_PAGO';
  monto: number;
  fecha: string;
  categoria: string | null;
  descripcion: string | null;
  referencia: string | null;
  metodoPago: string | null;
  notas: string | null;
  estadoCredito: string | null;
  montoPagado: number | null;
  clasificacionPago: string | null;
  montoGastoComun: number | null;
  montoFondoReserva: number | null;
  createdAt: string;
  updatedAt: string;
  apartamentoId: string | null;
}

export interface TransaccionConApartamento extends Transaccion {
  apartamento?: Apartamento | null;
  cuentaBancariaId?: string | null;
}

export async function getTransacciones(): Promise<Transaccion[]> {
  const database = await getDatabase();
  return database.select<Transaccion[]>('SELECT * FROM Transaccion ORDER BY fecha DESC');
}

export async function getTransaccionesConApartamento(): Promise<TransaccionConApartamento[]> {
  const database = await getDatabase();
  // Ejecutar queries en paralelo
  const [transacciones, apartamentos, movimientos] = await Promise.all([
    database.select<Transaccion[]>('SELECT * FROM Transaccion ORDER BY fecha DESC'),
    database.select<Apartamento[]>('SELECT * FROM Apartamento'),
    database.select<{ transaccionId: string; cuentaBancariaId: string }[]>(
      'SELECT transaccionId, cuentaBancariaId FROM MovimientoBancario WHERE transaccionId IS NOT NULL'
    )
  ]);
  const apartamentosMap = new Map(apartamentos.map(a => [a.id, a]));
  const movimientosMap = new Map(movimientos.map(m => [m.transaccionId, m.cuentaBancariaId]));

  return transacciones.map(t => ({
    ...t,
    apartamento: t.apartamentoId ? apartamentosMap.get(t.apartamentoId) || null : null,
    cuentaBancariaId: movimientosMap.get(t.id) || null
  }));
}

export async function getTransaccionesRecientes(limit: number = 10): Promise<TransaccionConApartamento[]> {
  const database = await getDatabase();
  // Ejecutar queries en paralelo
  const [transacciones, apartamentos] = await Promise.all([
    database.select<Transaccion[]>('SELECT * FROM Transaccion ORDER BY fecha DESC LIMIT ?', [limit]),
    database.select<Apartamento[]>('SELECT * FROM Apartamento')
  ]);
  const apartamentosMap = new Map(apartamentos.map(a => [a.id, a]));

  return transacciones.map(t => ({
    ...t,
    apartamento: t.apartamentoId ? apartamentosMap.get(t.apartamentoId) || null : null
  }));
}

export async function getTransaccionesByApartamento(apartamentoId: string): Promise<Transaccion[]> {
  const database = await getDatabase();
  return database.select<Transaccion[]>(
    'SELECT * FROM Transaccion WHERE apartamentoId = ? ORDER BY fecha DESC',
    [apartamentoId]
  );
}

export async function getTransaccionById(id: string): Promise<Transaccion | null> {
  const database = await getDatabase();
  const result = await database.select<Transaccion[]>('SELECT * FROM Transaccion WHERE id = ?', [id]);
  return result[0] || null;
}

export async function createTransaccion(data: Omit<Transaccion, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaccion> {
  const database = await getDatabase();
  const id = generateId();
  const now = getCurrentTimestamp();

  await database.execute(
    `INSERT INTO Transaccion (id, tipo, monto, fecha, categoria, descripcion, referencia, metodoPago, notas, estadoCredito, montoPagado, clasificacionPago, montoGastoComun, montoFondoReserva, apartamentoId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.tipo, data.monto, data.fecha, data.categoria, data.descripcion, data.referencia, data.metodoPago, data.notas, data.estadoCredito, data.montoPagado, data.clasificacionPago, data.montoGastoComun, data.montoFondoReserva, data.apartamentoId, now, now]
  );

  return (await getTransaccionById(id))!;
}

export async function updateTransaccion(id: string, data: Partial<Omit<Transaccion, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Transaccion> {
  const database = await getDatabase();
  const now = getCurrentTimestamp();

  const fields: string[] = [];
  const values: unknown[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await database.execute(
    `UPDATE Transaccion SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return (await getTransaccionById(id))!;
}

export async function deleteTransaccion(id: string): Promise<void> {
  const database = await getDatabase();

  // Obtener la transacción antes de eliminarla para saber si hay que recalcular
  const transaccion = await getTransaccionById(id);
  const apartamentoId = transaccion?.apartamentoId;
  const tipo = transaccion?.tipo;

  try {
    // Eliminar movimientos bancarios relacionados (en lugar de solo desvincular)
    await database.execute('DELETE FROM MovimientoBancario WHERE transaccionId = ?', [id]);

    // Eliminar la transacción
    await database.execute('DELETE FROM Transaccion WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error al eliminar transacción:', error);
    throw new Error(`Error al eliminar la transacción: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Si era un RECIBO_PAGO o VENTA_CREDITO, recalcular el estado de los créditos del apartamento
  if ((tipo === 'RECIBO_PAGO' || tipo === 'VENTA_CREDITO') && apartamentoId) {
    try {
      await recalcularEstadoCreditosApartamento(apartamentoId);
    } catch (error) {
      // Si falla el recálculo, no bloqueamos la eliminación
      console.error('Error al recalcular créditos:', error);
    }
  }
}

// Recalcular el estado de los créditos de un apartamento basándose en los pagos existentes
async function recalcularEstadoCreditosApartamento(apartamentoId: string): Promise<void> {
  const database = await getDatabase();

  // Obtener todos los créditos del apartamento ordenados por fecha (FIFO)
  const creditos = await database.select<Transaccion[]>(
    `SELECT * FROM Transaccion
     WHERE apartamentoId = ? AND tipo = 'VENTA_CREDITO'
     ORDER BY fecha ASC`,
    [apartamentoId]
  );

  // Obtener todos los recibos de pago del apartamento ordenados por fecha
  const recibos = await database.select<Transaccion[]>(
    `SELECT * FROM Transaccion
     WHERE apartamentoId = ? AND tipo = 'RECIBO_PAGO'
     ORDER BY fecha ASC`,
    [apartamentoId]
  );

  // Calcular el total pagado
  const totalPagado = recibos.reduce((sum, r) => sum + r.monto, 0);

  // Resetear todos los créditos a PENDIENTE con montoPagado = 0
  for (const credito of creditos) {
    await database.execute(
      `UPDATE Transaccion SET montoPagado = 0, estadoCredito = 'PENDIENTE', updatedAt = ? WHERE id = ?`,
      [getCurrentTimestamp(), credito.id]
    );
  }

  // Redistribuir los pagos en orden FIFO
  let montoRestante = totalPagado;

  for (const credito of creditos) {
    if (montoRestante <= 0) break;

    const montoCredito = credito.monto;
    const aplicar = Math.min(montoRestante, montoCredito);

    const nuevoEstado = aplicar >= montoCredito ? 'PAGADO' : 'PARCIAL';

    await database.execute(
      `UPDATE Transaccion SET montoPagado = ?, estadoCredito = ?, updatedAt = ? WHERE id = ?`,
      [aplicar, nuevoEstado, getCurrentTimestamp(), credito.id]
    );

    montoRestante -= aplicar;
  }
}

// Crear venta a crédito
export async function createVentaCredito(data: {
  monto: number;
  apartamentoId: string;
  fecha: string;
  categoria: string;
  descripcion: string | null;
}): Promise<Transaccion> {
  return createTransaccion({
    tipo: 'VENTA_CREDITO',
    monto: data.monto,
    fecha: data.fecha,
    categoria: data.categoria,
    descripcion: data.descripcion,
    estadoCredito: 'PENDIENTE',
    montoPagado: 0,
    apartamentoId: data.apartamentoId,
    referencia: null,
    metodoPago: null,
    notas: null,
    clasificacionPago: null,
    montoGastoComun: null,
    montoFondoReserva: null,
  });
}

// Actualizar venta a crédito con actualización automática de descripción
export async function updateVentaCredito(
  id: string,
  data: {
    monto?: number;
    apartamentoId?: string;
    fecha?: string;
    categoria?: 'GASTOS_COMUNES' | 'FONDO_RESERVA';
  }
): Promise<Transaccion> {
  const transaccion = await getTransaccionById(id);
  if (!transaccion) {
    throw new Error("Transacción no encontrada");
  }

  if (transaccion.tipo !== 'VENTA_CREDITO') {
    throw new Error("Esta función solo aplica para ventas a crédito");
  }

  // Actualizar la transacción
  const updateData: Record<string, unknown> = {};
  if (data.monto !== undefined) updateData.monto = data.monto;
  if (data.apartamentoId !== undefined) updateData.apartamentoId = data.apartamentoId;
  if (data.fecha !== undefined) updateData.fecha = data.fecha;
  if (data.categoria !== undefined) updateData.categoria = data.categoria;

  // Actualizar descripción si cambia la categoría
  if (data.categoria !== undefined) {
    updateData.descripcion = data.categoria === 'GASTOS_COMUNES' ? 'Gastos Comunes' : 'Fondo de Reserva';
  }

  return await updateTransaccion(id, updateData);
}

// ============ CUENTAS BANCARIAS ============

export interface CuentaBancaria {
  id: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  titular: string | null;
  saldoInicial: number;
  activa: boolean;
  porDefecto: boolean;
  createdAt: string;
  updatedAt: string;
}

// Tipo interno para la respuesta de SQLite (booleanos como números)
interface CuentaBancariaDB {
  id: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  titular: string | null;
  saldoInicial: number;
  activa: number;
  porDefecto: number;
  createdAt: string;
  updatedAt: string;
}

export interface CuentaBancariaConMovimientos extends CuentaBancaria {
  movimientos: MovimientoBancario[];
}

export async function getCuentasBancarias(): Promise<CuentaBancaria[]> {
  const database = await getDatabase();
  const result = await database.select<CuentaBancariaDB[]>(
    'SELECT * FROM CuentaBancaria ORDER BY porDefecto DESC, banco'
  );
  return result.map(c => ({ ...c, activa: Boolean(c.activa), porDefecto: Boolean(c.porDefecto) }));
}

export async function getCuentasBancariasConMovimientos(): Promise<CuentaBancariaConMovimientos[]> {
  const cuentas = await getCuentasBancarias();
  const movimientos = await getMovimientosBancarios();

  return cuentas.map(cuenta => ({
    ...cuenta,
    movimientos: movimientos.filter(m => m.cuentaBancariaId === cuenta.id)
  }));
}

export async function getCuentaBancariaById(id: string): Promise<CuentaBancaria | null> {
  const database = await getDatabase();
  const result = await database.select<CuentaBancariaDB[]>(
    'SELECT * FROM CuentaBancaria WHERE id = ?',
    [id]
  );
  if (!result[0]) return null;
  return { ...result[0], activa: Boolean(result[0].activa), porDefecto: Boolean(result[0].porDefecto) };
}

export async function createCuentaBancaria(data: Omit<CuentaBancaria, 'id' | 'createdAt' | 'updatedAt' | 'activa'>): Promise<CuentaBancaria> {
  const database = await getDatabase();
  const id = generateId();
  const now = getCurrentTimestamp();

  // Si se marca como por defecto, desmarcar las demás
  if (data.porDefecto) {
    await database.execute('UPDATE CuentaBancaria SET porDefecto = 0 WHERE porDefecto = 1', []);
  }

  await database.execute(
    `INSERT INTO CuentaBancaria (id, banco, tipoCuenta, numeroCuenta, titular, saldoInicial, activa, porDefecto, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.banco, data.tipoCuenta, data.numeroCuenta, data.titular, data.saldoInicial, 1, data.porDefecto ? 1 : 0, now, now]
  );

  return (await getCuentaBancariaById(id))!;
}

export async function updateCuentaBancaria(id: string, data: Partial<Omit<CuentaBancaria, 'id' | 'createdAt' | 'updatedAt'>>): Promise<CuentaBancaria> {
  const database = await getDatabase();
  const now = getCurrentTimestamp();

  // Si se marca como por defecto, desmarcar las demás
  if (data.porDefecto) {
    await database.execute('UPDATE CuentaBancaria SET porDefecto = 0 WHERE porDefecto = 1 AND id != ?', [id]);
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'activa' || key === 'porDefecto') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    }
  });

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await database.execute(
    `UPDATE CuentaBancaria SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return (await getCuentaBancariaById(id))!;
}

export async function deleteCuentaBancaria(id: string): Promise<void> {
  const database = await getDatabase();
  await database.execute('DELETE FROM CuentaBancaria WHERE id = ?', [id]);
}

// ============ MOVIMIENTOS BANCARIOS ============

export interface MovimientoBancario {
  id: string;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  numeroDocumento: string | null;
  archivoUrl: string | null;
  clasificacion: string | null;
  conciliado: boolean;
  createdAt: string;
  updatedAt: string;
  cuentaBancariaId: string;
  transaccionId: string | null;
  servicioId: string | null;
}

interface MovimientoBancarioDB {
  id: string;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  numeroDocumento: string | null;
  archivoUrl: string | null;
  clasificacion: string | null;
  conciliado: number;
  createdAt: string;
  updatedAt: string;
  cuentaBancariaId: string;
  transaccionId: string | null;
  servicioId: string | null;
}

export interface MovimientoBancarioCompleto extends MovimientoBancario {
  cuentaBancaria?: {
    id: string;
    banco: string;
    numeroCuenta: string;
  };
  transaccion?: {
    id: string;
    tipo: string;
    apartamento?: {
      numero: string;
    } | null;
  } | null;
  servicio?: {
    id: string;
    nombre: string;
    tipo: string;
  } | null;
}

export async function getMovimientosBancarios(cuentaBancariaId?: string): Promise<MovimientoBancario[]> {
  const database = await getDatabase();
  let query = 'SELECT * FROM MovimientoBancario';
  const params: string[] = [];

  if (cuentaBancariaId) {
    query += ' WHERE cuentaBancariaId = ?';
    params.push(cuentaBancariaId);
  }

  query += ' ORDER BY fecha DESC';

  const result = await database.select<MovimientoBancarioDB[]>(query, params);
  return result.map(m => ({ ...m, conciliado: Boolean(m.conciliado) }));
}

export async function getMovimientosBancariosCompletos(cuentaBancariaId?: string): Promise<MovimientoBancarioCompleto[]> {
  const database = await getDatabase();

  // Ejecutar todas las queries en paralelo
  const [movimientos, cuentasDB, transacciones, apartamentos, serviciosDB] = await Promise.all([
    getMovimientosBancarios(cuentaBancariaId),
    database.select<CuentaBancariaDB[]>('SELECT id, banco, numeroCuenta FROM CuentaBancaria'),
    database.select<Transaccion[]>('SELECT id, tipo, apartamentoId FROM Transaccion'),
    database.select<Apartamento[]>('SELECT id, numero FROM Apartamento'),
    database.select<ServicioDB[]>('SELECT id, nombre, tipo FROM Servicio')
  ]);

  const apartamentosMap = new Map(apartamentos.map(a => [a.id, a]));
  const cuentasMap = new Map(cuentasDB.map(c => [c.id, { id: c.id, banco: c.banco, numeroCuenta: c.numeroCuenta }]));
  const transaccionesMap = new Map(transacciones.map(t => [t.id, {
    id: t.id,
    tipo: t.tipo,
    apartamento: t.apartamentoId ? { numero: apartamentosMap.get(t.apartamentoId)?.numero || '' } : null
  }]));
  const serviciosMap = new Map(serviciosDB.map(s => [s.id, { id: s.id, nombre: s.nombre, tipo: s.tipo }]));

  return movimientos.map(m => ({
    ...m,
    cuentaBancaria: cuentasMap.get(m.cuentaBancariaId),
    transaccion: m.transaccionId ? transaccionesMap.get(m.transaccionId) : null,
    servicio: m.servicioId ? serviciosMap.get(m.servicioId) : null
  }));
}

export async function getMovimientoBancarioById(id: string): Promise<MovimientoBancario | null> {
  const database = await getDatabase();
  const result = await database.select<MovimientoBancarioDB[]>(
    'SELECT * FROM MovimientoBancario WHERE id = ?',
    [id]
  );
  if (!result[0]) return null;
  return { ...result[0], conciliado: Boolean(result[0].conciliado) };
}

export async function getMovimientoBancarioByTransaccionId(transaccionId: string): Promise<MovimientoBancario | null> {
  const database = await getDatabase();
  const result = await database.select<MovimientoBancarioDB[]>(
    'SELECT * FROM MovimientoBancario WHERE transaccionId = ?',
    [transaccionId]
  );
  if (!result[0]) return null;
  return { ...result[0], conciliado: Boolean(result[0].conciliado) };
}

// Obtener información del banco vinculado a una transacción (para mostrar en diálogos de confirmación)
export interface InfoBancoVinculado {
  tieneVinculo: boolean;
  banco?: string;
  numeroCuenta?: string;
  monto?: number;
}

export async function getInfoBancoVinculadoTransaccion(transaccionId: string): Promise<InfoBancoVinculado> {
  const movimiento = await getMovimientoBancarioByTransaccionId(transaccionId);
  if (!movimiento) {
    return { tieneVinculo: false };
  }

  const cuenta = await getCuentaBancariaById(movimiento.cuentaBancariaId);
  return {
    tieneVinculo: true,
    banco: cuenta?.banco,
    numeroCuenta: cuenta?.numeroCuenta,
    monto: movimiento.monto,
  };
}

export async function createMovimientoBancario(data: Omit<MovimientoBancario, 'id' | 'createdAt' | 'updatedAt'>): Promise<MovimientoBancario> {
  const database = await getDatabase();
  const id = generateId();
  const now = getCurrentTimestamp();

  await database.execute(
    `INSERT INTO MovimientoBancario (id, tipo, monto, fecha, descripcion, referencia, numeroDocumento, archivoUrl, clasificacion, conciliado, cuentaBancariaId, transaccionId, servicioId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.tipo, data.monto, data.fecha, data.descripcion, data.referencia, data.numeroDocumento, data.archivoUrl, data.clasificacion, data.conciliado ? 1 : 0, data.cuentaBancariaId, data.transaccionId, data.servicioId, now, now]
  );

  return (await getMovimientoBancarioById(id))!;
}

export async function updateMovimientoBancario(id: string, data: Partial<Omit<MovimientoBancario, 'id' | 'createdAt' | 'updatedAt'>>): Promise<MovimientoBancario> {
  const database = await getDatabase();
  const now = getCurrentTimestamp();

  const fields: string[] = [];
  const values: unknown[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'conciliado') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    }
  });

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await database.execute(
    `UPDATE MovimientoBancario SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return (await getMovimientoBancarioById(id))!;
}

export async function deleteMovimientoBancario(id: string): Promise<void> {
  const database = await getDatabase();
  await database.execute('DELETE FROM MovimientoBancario WHERE id = ?', [id]);
}

// Información de transacción vinculada a un movimiento bancario
export interface InfoTransaccionVinculada {
  tieneVinculo: boolean;
  transaccionId?: string;
  tipo?: string;
  apartamentoId?: string | null;
  apartamentoNumero?: string;
  monto?: number;
}

// Obtener información de la transacción vinculada a un movimiento bancario
export async function getInfoTransaccionVinculadaMovimiento(movimientoId: string): Promise<InfoTransaccionVinculada> {
  const movimiento = await getMovimientoBancarioById(movimientoId);
  if (!movimiento || !movimiento.transaccionId) {
    return { tieneVinculo: false };
  }

  const transaccion = await getTransaccionById(movimiento.transaccionId);
  if (!transaccion) {
    return { tieneVinculo: false };
  }

  let apartamentoNumero: string | undefined;
  if (transaccion.apartamentoId) {
    const apartamento = await getApartamentoById(transaccion.apartamentoId);
    apartamentoNumero = apartamento?.numero;
  }

  return {
    tieneVinculo: true,
    transaccionId: transaccion.id,
    tipo: transaccion.tipo,
    apartamentoId: transaccion.apartamentoId,
    apartamentoNumero,
    monto: transaccion.monto,
  };
}

// Actualizar movimiento bancario y su transacción vinculada (si existe)
export async function updateMovimientoBancarioConTransaccion(
  id: string,
  data: Partial<Omit<MovimientoBancario, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<{ movimiento: MovimientoBancario; transaccionActualizada: boolean }> {
  const movimiento = await getMovimientoBancarioById(id);
  if (!movimiento) {
    throw new Error("Movimiento bancario no encontrado");
  }

  // Actualizar el movimiento bancario
  const movimientoActualizado = await updateMovimientoBancario(id, data);

  let transaccionActualizada = false;

  // Si tiene transacción vinculada, sincronizar los datos relevantes
  if (movimiento.transaccionId) {
    const transaccion = await getTransaccionById(movimiento.transaccionId);
    if (transaccion) {
      const updateTransaccionData: Record<string, unknown> = {};

      // Sincronizar campos que deben coincidir
      if (data.monto !== undefined) {
        updateTransaccionData.monto = data.monto;
      }
      if (data.fecha !== undefined) {
        updateTransaccionData.fecha = data.fecha;
      }
      if (data.referencia !== undefined) {
        updateTransaccionData.referencia = data.referencia;
      }
      if (data.descripcion !== undefined) {
        // Actualizar descripción/notas en la transacción
        updateTransaccionData.descripcion = data.descripcion;
      }
      if (data.clasificacion !== undefined) {
        // Sincronizar clasificación a la transacción
        updateTransaccionData.clasificacionPago = data.clasificacion;
      }

      if (Object.keys(updateTransaccionData).length > 0) {
        await updateTransaccion(movimiento.transaccionId, updateTransaccionData);
        transaccionActualizada = true;

        // Si es un RECIBO_PAGO y cambió el monto, recalcular créditos del apartamento
        if (transaccion.tipo === 'RECIBO_PAGO' && data.monto !== undefined && transaccion.apartamentoId) {
          await recalcularEstadoCreditosApartamento(transaccion.apartamentoId);
        }
      }
    }
  }

  return { movimiento: movimientoActualizado, transaccionActualizada };
}

// Eliminar movimiento bancario y su transacción vinculada (si existe), recalculando deudas
export async function deleteMovimientoBancarioConTransaccion(id: string): Promise<{
  transaccionEliminada: boolean;
  apartamentoRecalculado: string | null
}> {
  const movimiento = await getMovimientoBancarioById(id);
  if (!movimiento) {
    throw new Error("Movimiento bancario no encontrado");
  }

  let transaccionEliminada = false;
  let apartamentoRecalculado: string | null = null;

  // Si tiene transacción vinculada, eliminarla también
  if (movimiento.transaccionId) {
    const transaccion = await getTransaccionById(movimiento.transaccionId);
    if (transaccion) {
      // Guardar apartamentoId antes de eliminar
      const apartamentoId = transaccion.apartamentoId;
      const tipo = transaccion.tipo;

      // Eliminar el movimiento bancario primero
      const database = await getDatabase();
      await database.execute('DELETE FROM MovimientoBancario WHERE id = ?', [id]);

      // Eliminar la transacción
      await database.execute('DELETE FROM Transaccion WHERE id = ?', [movimiento.transaccionId]);
      transaccionEliminada = true;

      // Recalcular créditos si era RECIBO_PAGO o VENTA_CREDITO
      if ((tipo === 'RECIBO_PAGO' || tipo === 'VENTA_CREDITO') && apartamentoId) {
        await recalcularEstadoCreditosApartamento(apartamentoId);
        apartamentoRecalculado = apartamentoId;
      }
    } else {
      // La transacción ya no existe, solo eliminar el movimiento
      await deleteMovimientoBancario(id);
    }
  } else {
    // No tiene transacción vinculada, eliminar solo el movimiento
    await deleteMovimientoBancario(id);
  }

  return { transaccionEliminada, apartamentoRecalculado };
}

export async function conciliarMovimiento(id: string, conciliado: boolean): Promise<MovimientoBancario> {
  return updateMovimientoBancario(id, { conciliado });
}

// ============ TIPOS DE SERVICIO ============

export interface TipoServicio {
  id: string;
  codigo: string;
  nombre: string;
  color: string;
  orden: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TipoServicioDB {
  id: string;
  codigo: string;
  nombre: string;
  color: string;
  orden: number;
  activo: number;
  createdAt: string;
  updatedAt: string;
}

// Tipos de servicio predeterminados
const TIPOS_SERVICIO_DEFAULT: Array<{ codigo: string; nombre: string; color: string }> = [
  { codigo: 'ELECTRICISTA', nombre: 'Electricista', color: 'default' },
  { codigo: 'PLOMERO', nombre: 'Plomero', color: 'secondary' },
  { codigo: 'SANITARIO', nombre: 'Sanitario', color: 'secondary' },
  { codigo: 'CERRAJERO', nombre: 'Cerrajero', color: 'default' },
  { codigo: 'PINTOR', nombre: 'Pintor', color: 'outline' },
  { codigo: 'CARPINTERO', nombre: 'Carpintero', color: 'outline' },
  { codigo: 'ALBANIL', nombre: 'Albañil', color: 'outline' },
  { codigo: 'JARDINERO', nombre: 'Jardinero', color: 'secondary' },
  { codigo: 'LIMPIEZA', nombre: 'Limpieza', color: 'secondary' },
  { codigo: 'SEGURIDAD', nombre: 'Seguridad', color: 'destructive' },
  { codigo: 'FUMIGACION', nombre: 'Fumigación', color: 'default' },
  { codigo: 'ASCENSOR', nombre: 'Ascensor', color: 'default' },
  { codigo: 'VIDRIERIA', nombre: 'Vidriería', color: 'outline' },
  { codigo: 'HERRERIA', nombre: 'Herrería', color: 'outline' },
  { codigo: 'AIRE_ACONDICIONADO', nombre: 'Aire Acondicionado', color: 'default' },
  { codigo: 'GAS', nombre: 'Gas', color: 'destructive' },
  { codigo: 'UTE', nombre: 'UTE (Electricidad)', color: 'destructive' },
  { codigo: 'OSE', nombre: 'OSE (Agua)', color: 'secondary' },
  { codigo: 'TARIFA_SANEAMIENTO', nombre: 'Tarifa de Saneamiento', color: 'secondary' },
  { codigo: 'OTRO', nombre: 'Otro', color: 'outline' },
];

// Variable para evitar múltiples inicializaciones de la tabla TipoServicio
let tipoServicioTableInitialized = false;

// Función para asegurar que la tabla TipoServicio existe y tiene datos
// Nota: La tabla se crea en initDatabase() via INIT_SQL, esta función es defensiva
async function ensureTipoServicioTable(): Promise<void> {
  if (tipoServicioTableInitialized) return;

  // Asegurar que los datos predeterminados existan
  await initTiposServicioDefault();
  tipoServicioTableInitialized = true;
}

export async function getTiposServicio(): Promise<TipoServicio[]> {
  await ensureTipoServicioTable();
  const database = await getDatabase();
  const result = await database.select<TipoServicioDB[]>(
    'SELECT * FROM TipoServicio ORDER BY orden, nombre'
  );
  return result.map(t => ({ ...t, activo: Boolean(t.activo) }));
}

export async function getTiposServicioActivos(): Promise<TipoServicio[]> {
  await ensureTipoServicioTable();
  const database = await getDatabase();
  const result = await database.select<TipoServicioDB[]>(
    'SELECT * FROM TipoServicio WHERE activo = 1 ORDER BY orden, nombre'
  );
  return result.map(t => ({ ...t, activo: Boolean(t.activo) }));
}

export async function getTipoServicioById(id: string): Promise<TipoServicio | null> {
  const database = await getDatabase();
  const result = await database.select<TipoServicioDB[]>(
    'SELECT * FROM TipoServicio WHERE id = ?',
    [id]
  );
  if (!result[0]) return null;
  return { ...result[0], activo: Boolean(result[0].activo) };
}

export async function getTipoServicioByCodigo(codigo: string): Promise<TipoServicio | null> {
  const database = await getDatabase();
  const result = await database.select<TipoServicioDB[]>(
    'SELECT * FROM TipoServicio WHERE codigo = ?',
    [codigo]
  );
  if (!result[0]) return null;
  return { ...result[0], activo: Boolean(result[0].activo) };
}

export async function createTipoServicio(data: {
  codigo: string;
  nombre: string;
  color?: string;
}): Promise<TipoServicio> {
  await ensureTipoServicioTable();
  const database = await getDatabase();
  const id = generateId();
  const now = getCurrentTimestamp();
  const codigoNormalizado = data.codigo.toUpperCase().trim();

  if (!codigoNormalizado) {
    throw new Error('El código no puede estar vacío');
  }

  if (!data.nombre.trim()) {
    throw new Error('El nombre no puede estar vacío');
  }

  // Verificar si ya existe un tipo con ese código
  const existente = await getTipoServicioByCodigo(codigoNormalizado);
  if (existente) {
    throw new Error(`Ya existe un tipo de servicio con el código "${codigoNormalizado}"`);
  }

  // Obtener el máximo orden actual
  const maxOrdenResult = await database.select<{ maxOrden: number | null }[]>(
    'SELECT MAX(orden) as maxOrden FROM TipoServicio'
  );
  const nuevoOrden = (maxOrdenResult[0]?.maxOrden ?? -1) + 1;

  try {
    await database.execute(
      `INSERT INTO TipoServicio (id, codigo, nombre, color, orden, activo, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, codigoNormalizado, data.nombre.trim(), data.color || 'default', nuevoOrden, 1, now, now]
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('UNIQUE constraint failed') || errorMsg.includes('codigo')) {
      throw new Error(`Ya existe un tipo de servicio con el código "${codigoNormalizado}"`);
    }
    throw new Error(`Error al insertar en la base de datos: ${errorMsg}`);
  }

  const created = await getTipoServicioById(id);
  if (!created) {
    throw new Error('Error al recuperar el tipo de servicio recién creado');
  }
  return created;
}

export async function updateTipoServicio(
  id: string,
  data: Partial<{ codigo: string; nombre: string; color: string; activo: boolean; orden: number }>
): Promise<TipoServicio> {
  const database = await getDatabase();
  const now = getCurrentTimestamp();

  const fields: string[] = [];
  const values: unknown[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'activo') {
        values.push(value ? 1 : 0);
      } else if (key === 'codigo') {
        values.push((value as string).toUpperCase());
      } else {
        values.push(value);
      }
    }
  });

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await database.execute(
    `UPDATE TipoServicio SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return (await getTipoServicioById(id))!;
}

export async function deleteTipoServicio(id: string): Promise<void> {
  const database = await getDatabase();
  // Verificar si hay servicios usando este tipo
  const serviciosConTipo = await database.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM Servicio WHERE tipo = (SELECT codigo FROM TipoServicio WHERE id = ?)',
    [id]
  );
  if (serviciosConTipo[0]?.count > 0) {
    throw new Error('No se puede eliminar este tipo porque hay servicios que lo utilizan');
  }
  await database.execute('DELETE FROM TipoServicio WHERE id = ?', [id]);
}

export async function initTiposServicioDefault(): Promise<void> {
  const database = await getDatabase();
  const existentes = await database.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM TipoServicio'
  );

  if (existentes[0]?.count === 0) {
    const now = getCurrentTimestamp();
    for (let i = 0; i < TIPOS_SERVICIO_DEFAULT.length; i++) {
      const tipo = TIPOS_SERVICIO_DEFAULT[i];
      const id = generateId();
      await database.execute(
        `INSERT INTO TipoServicio (id, codigo, nombre, color, orden, activo, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tipo.codigo, tipo.nombre, tipo.color, i, 1, now, now]
      );
    }
  }
}

// ============ SERVICIOS ============

export interface Servicio {
  id: string;
  tipo: string;
  nombre: string;
  celular: string | null;
  email: string | null;
  banco: string | null;
  numeroCuenta: string | null;
  observaciones: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ServicioDB {
  id: string;
  tipo: string;
  nombre: string;
  celular: string | null;
  email: string | null;
  banco: string | null;
  numeroCuenta: string | null;
  observaciones: string | null;
  activo: number;
  createdAt: string;
  updatedAt: string;
}

export async function getServicios(): Promise<Servicio[]> {
  const database = await getDatabase();
  const result = await database.select<ServicioDB[]>('SELECT * FROM Servicio ORDER BY nombre');
  return result.map(s => ({ ...s, activo: Boolean(s.activo) }));
}

export async function getServiciosActivos(): Promise<Servicio[]> {
  const database = await getDatabase();
  const result = await database.select<ServicioDB[]>(
    'SELECT * FROM Servicio WHERE activo = 1 ORDER BY nombre'
  );
  return result.map(s => ({ ...s, activo: Boolean(s.activo) }));
}

export async function getServicioById(id: string): Promise<Servicio | null> {
  const database = await getDatabase();
  const result = await database.select<ServicioDB[]>(
    'SELECT * FROM Servicio WHERE id = ?',
    [id]
  );
  if (!result[0]) return null;
  return { ...result[0], activo: Boolean(result[0].activo) };
}

export async function createServicio(data: Omit<Servicio, 'id' | 'createdAt' | 'updatedAt' | 'activo'>): Promise<Servicio> {
  const database = await getDatabase();
  const id = generateId();
  const now = getCurrentTimestamp();

  await database.execute(
    `INSERT INTO Servicio (id, tipo, nombre, celular, email, banco, numeroCuenta, observaciones, activo, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.tipo, data.nombre, data.celular, data.email, data.banco, data.numeroCuenta, data.observaciones, 1, now, now]
  );

  return (await getServicioById(id))!;
}

export async function updateServicio(id: string, data: Partial<Omit<Servicio, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Servicio> {
  const database = await getDatabase();
  const now = getCurrentTimestamp();

  const fields: string[] = [];
  const values: unknown[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'activo') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    }
  });

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await database.execute(
    `UPDATE Servicio SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return (await getServicioById(id))!;
}

export async function deleteServicio(id: string): Promise<void> {
  const database = await getDatabase();
  await database.execute('DELETE FROM Servicio WHERE id = ?', [id]);
}

// ============ REGISTROS (BITACORA) ============

export interface Registro {
  id: string;
  fecha: string;
  tipo: string;
  detalle: string;
  observaciones: string | null;
  situacion: string;
  createdAt: string;
  updatedAt: string;
}

export async function getRegistros(): Promise<Registro[]> {
  const database = await getDatabase();
  return database.select<Registro[]>('SELECT * FROM Registro ORDER BY fecha DESC');
}

export async function getRegistroById(id: string): Promise<Registro | null> {
  const database = await getDatabase();
  const result = await database.select<Registro[]>('SELECT * FROM Registro WHERE id = ?', [id]);
  return result[0] || null;
}

export async function createRegistro(data: Omit<Registro, 'id' | 'createdAt' | 'updatedAt'>): Promise<Registro> {
  const database = await getDatabase();
  const id = generateId();
  const now = getCurrentTimestamp();

  await database.execute(
    `INSERT INTO Registro (id, fecha, tipo, detalle, observaciones, situacion, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.fecha, data.tipo, data.detalle, data.observaciones, data.situacion, now, now]
  );

  return (await getRegistroById(id))!;
}

export async function updateRegistro(id: string, data: Partial<Omit<Registro, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Registro> {
  const database = await getDatabase();
  const now = getCurrentTimestamp();

  const fields: string[] = [];
  const values: unknown[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await database.execute(
    `UPDATE Registro SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return (await getRegistroById(id))!;
}

export async function deleteRegistro(id: string): Promise<void> {
  const database = await getDatabase();
  await database.execute('DELETE FROM Registro WHERE id = ?', [id]);
}

// ============ INQUILINOS ============

export interface Inquilino {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string | null;
  email: string | null;
  telefono: string | null;
  tipo: 'PROPIETARIO' | 'INQUILINO';
  activo: boolean;
  fechaIngreso: string;
  fechaSalida: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  apartamentoId: string | null;
}

interface InquilinoDB {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string | null;
  email: string | null;
  telefono: string | null;
  tipo: 'PROPIETARIO' | 'INQUILINO';
  activo: number;
  fechaIngreso: string;
  fechaSalida: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  apartamentoId: string | null;
}

export async function getInquilinos(): Promise<Inquilino[]> {
  const database = await getDatabase();
  const result = await database.select<InquilinoDB[]>('SELECT * FROM Inquilino ORDER BY nombre');
  return result.map(i => ({ ...i, activo: Boolean(i.activo) }));
}

export async function getInquilinosByApartamento(apartamentoId: string): Promise<Inquilino[]> {
  const database = await getDatabase();
  const result = await database.select<InquilinoDB[]>(
    'SELECT * FROM Inquilino WHERE apartamentoId = ? ORDER BY nombre',
    [apartamentoId]
  );
  return result.map(i => ({ ...i, activo: Boolean(i.activo) }));
}

// ============ AVISOS E INFORMES ============

export interface AvisoInforme {
  id: string;
  texto: string;
  orden: number;
  mes: number;
  anio: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AvisoInformeDB {
  id: string;
  texto: string;
  orden: number;
  mes: number;
  anio: number;
  activo: number;
  createdAt: string;
  updatedAt: string;
}

export async function getAvisosInforme(mes: number, anio: number): Promise<AvisoInforme[]> {
  const database = await getDatabase();
  const result = await database.select<AvisoInformeDB[]>(
    'SELECT * FROM AvisoInforme WHERE mes = ? AND anio = ? ORDER BY orden',
    [mes, anio]
  );
  return result.map(a => ({ ...a, activo: Boolean(a.activo) }));
}

export async function getAvisoInformeById(id: string): Promise<AvisoInforme | null> {
  const database = await getDatabase();
  const result = await database.select<AvisoInformeDB[]>(
    'SELECT * FROM AvisoInforme WHERE id = ?',
    [id]
  );
  if (!result[0]) return null;
  return { ...result[0], activo: Boolean(result[0].activo) };
}

export async function createAvisoInforme(data: { texto: string; mes: number; anio: number }): Promise<AvisoInforme> {
  const database = await getDatabase();
  const id = generateId();
  const now = getCurrentTimestamp();

  // Obtener el máximo orden actual para el mes/año
  const maxOrdenResult = await database.select<{ maxOrden: number | null }[]>(
    'SELECT MAX(orden) as maxOrden FROM AvisoInforme WHERE mes = ? AND anio = ?',
    [data.mes, data.anio]
  );
  const nuevoOrden = (maxOrdenResult[0]?.maxOrden ?? -1) + 1;

  await database.execute(
    `INSERT INTO AvisoInforme (id, texto, orden, mes, anio, activo, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.texto, nuevoOrden, data.mes, data.anio, 1, now, now]
  );

  return (await getAvisoInformeById(id))!;
}

export async function updateAvisoInforme(id: string, data: { texto?: string; activo?: boolean }): Promise<AvisoInforme> {
  const database = await getDatabase();
  const now = getCurrentTimestamp();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.texto !== undefined) {
    fields.push('texto = ?');
    values.push(data.texto);
  }
  if (data.activo !== undefined) {
    fields.push('activo = ?');
    values.push(data.activo ? 1 : 0);
  }

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await database.execute(
    `UPDATE AvisoInforme SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return (await getAvisoInformeById(id))!;
}

export async function deleteAvisoInforme(id: string): Promise<void> {
  const database = await getDatabase();

  // Obtener el aviso a eliminar para conocer su mes/anio
  const aviso = await getAvisoInformeById(id);
  if (!aviso) return;

  // Eliminar el aviso
  await database.execute('DELETE FROM AvisoInforme WHERE id = ?', [id]);

  // Recalcular el orden de los avisos restantes para ese mes/año
  const avisosRestantes = await getAvisosInforme(aviso.mes, aviso.anio);
  if (avisosRestantes.length > 0) {
    const now = getCurrentTimestamp();
    await Promise.all(
      avisosRestantes.map((a, index) =>
        database.execute(
          'UPDATE AvisoInforme SET orden = ?, updatedAt = ? WHERE id = ?',
          [index, now, a.id]
        )
      )
    );
  }
}

export async function reorderAvisosInforme(avisos: { id: string; orden: number }[]): Promise<void> {
  const database = await getDatabase();
  const now = getCurrentTimestamp();

  // Ejecutar todos los updates en paralelo
  await Promise.all(
    avisos.map(aviso =>
      database.execute(
        'UPDATE AvisoInforme SET orden = ?, updatedAt = ? WHERE id = ?',
        [aviso.orden, now, aviso.id]
      )
    )
  );
}

// ============ CONFIGURACION INFORME ============

export interface ConfiguracionInforme {
  id: string;
  clave: string;
  valor: string;
  createdAt: string;
  updatedAt: string;
}

export async function getConfiguracionInforme(clave: string): Promise<ConfiguracionInforme | null> {
  const database = await getDatabase();
  const result = await database.select<ConfiguracionInforme[]>(
    'SELECT * FROM ConfiguracionInforme WHERE clave = ?',
    [clave]
  );
  return result[0] || null;
}

export async function setConfiguracionInforme(clave: string, valor: string): Promise<ConfiguracionInforme> {
  const database = await getDatabase();
  const existing = await getConfiguracionInforme(clave);
  const now = getCurrentTimestamp();

  if (existing) {
    await database.execute(
      'UPDATE ConfiguracionInforme SET valor = ?, updatedAt = ? WHERE clave = ?',
      [valor, now, clave]
    );
    return (await getConfiguracionInforme(clave))!;
  } else {
    const id = generateId();
    await database.execute(
      'INSERT INTO ConfiguracionInforme (id, clave, valor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
      [id, clave, valor, now, now]
    );
    return (await getConfiguracionInforme(clave))!;
  }
}

// ============ FUNCIONES DE NEGOCIO ============

// Generar transacciones mensuales (gastos comunes y fondo de reserva)
export async function generarTransaccionesMensuales(): Promise<{ creadas: number; mes: string }> {
  const ahora = new Date();
  const mesActual = ahora.toLocaleString('es', { month: 'long', year: 'numeric' });
  const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
  const ultimoDiaMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const apartamentos = await getApartamentos();

  if (apartamentos.length === 0) {
    throw new Error("No hay apartamentos registrados");
  }

  let transaccionesCreadas = 0;

  for (const apt of apartamentos) {
    const transacciones = await getTransaccionesByApartamento(apt.id);

    const transaccionesDelMes = transacciones.filter(t => {
      const fechaTrans = new Date(t.fecha);
      return t.tipo === 'VENTA_CREDITO' &&
             fechaTrans >= new Date(primerDiaMes) &&
             fechaTrans <= new Date(ultimoDiaMes) &&
             (t.categoria === 'GASTOS_COMUNES' || t.categoria === 'FONDO_RESERVA');
    });

    const tieneGastosComunes = transaccionesDelMes.some(t => t.categoria === 'GASTOS_COMUNES');
    const tieneFondoReserva = transaccionesDelMes.some(t => t.categoria === 'FONDO_RESERVA');

    if (!tieneGastosComunes && apt.gastosComunes > 0) {
      await createTransaccion({
        tipo: 'VENTA_CREDITO',
        monto: apt.gastosComunes,
        fecha: ahora.toISOString(),
        categoria: 'GASTOS_COMUNES',
        descripcion: `Gastos Comunes - ${mesActual}`,
        estadoCredito: 'PENDIENTE',
        montoPagado: 0,
        apartamentoId: apt.id,
        referencia: null,
        metodoPago: null,
        notas: null,
        clasificacionPago: null,
        montoGastoComun: null,
        montoFondoReserva: null,
      });
      transaccionesCreadas++;
    }

    if (!tieneFondoReserva && apt.fondoReserva > 0) {
      await createTransaccion({
        tipo: 'VENTA_CREDITO',
        monto: apt.fondoReserva,
        fecha: ahora.toISOString(),
        categoria: 'FONDO_RESERVA',
        descripcion: `Fondo de Reserva - ${mesActual}`,
        estadoCredito: 'PENDIENTE',
        montoPagado: 0,
        apartamentoId: apt.id,
        referencia: null,
        metodoPago: null,
        notas: null,
        clasificacionPago: null,
        montoGastoComun: null,
        montoFondoReserva: null,
      });
      transaccionesCreadas++;
    }
  }

  if (transaccionesCreadas === 0) {
    throw new Error(`Ya se generaron las transacciones para ${mesActual}`);
  }

  return { creadas: transaccionesCreadas, mes: mesActual };
}

// Obtener saldos de cuenta corriente - Optimizado para evitar N+1
// Saldo = Total créditos (VENTA_CREDITO) - Total pagos (RECIBO_PAGO)
// Si saldo > 0: el cliente debe dinero
// Si saldo < 0: el cliente tiene saldo a favor
export async function obtenerSaldosCuentaCorriente(): Promise<Record<string, number>> {
  const database = await getDatabase();

  // Query que calcula: créditos - pagos por apartamento
  const saldosDB = await database.select<{ apartamentoId: string; saldo: number }[]>(`
    SELECT
      apartamentoId,
      SUM(CASE
        WHEN tipo = 'VENTA_CREDITO' THEN monto
        WHEN tipo = 'RECIBO_PAGO' THEN -monto
        ELSE 0
      END) as saldo
    FROM Transaccion
    WHERE (tipo = 'VENTA_CREDITO' OR tipo = 'RECIBO_PAGO') AND apartamentoId IS NOT NULL
    GROUP BY apartamentoId
  `);

  const saldos: Record<string, number> = {};
  for (const row of saldosDB) {
    saldos[row.apartamentoId] = row.saldo;
  }

  return saldos;
}

// Obtener deudas desglosadas por concepto (GC y FR) para un apartamento
export interface DeudasPorConcepto {
  gastosComunes: number;
  fondoReserva: number;
  total: number;
}

export async function obtenerDeudasPorConcepto(apartamentoId: string): Promise<DeudasPorConcepto> {
  const database = await getDatabase();

  // Obtener créditos (VENTA_CREDITO) pendientes/parciales y pagos (RECIBO_PAGO) del apartamento
  const creditos = await database.select<{ categoria: string; monto: number; montoPagado: number }[]>(`
    SELECT categoria, monto, COALESCE(montoPagado, 0) as montoPagado
    FROM Transaccion
    WHERE apartamentoId = ?
      AND tipo = 'VENTA_CREDITO'
      AND (estadoCredito = 'PENDIENTE' OR estadoCredito = 'PARCIAL')
  `, [apartamentoId]);

  // Calcular totales de créditos por categoría
  let creditosGC = 0;
  let creditosFR = 0;

  for (const credito of creditos) {
    const pendiente = credito.monto - credito.montoPagado;
    if (credito.categoria === 'GASTOS_COMUNES') {
      creditosGC += pendiente;
    } else if (credito.categoria === 'FONDO_RESERVA') {
      creditosFR += pendiente;
    }
  }

  return {
    gastosComunes: Math.max(0, creditosGC),
    fondoReserva: Math.max(0, creditosFR),
    total: Math.max(0, creditosGC) + Math.max(0, creditosFR),
  };
}

// Obtener créditos pendientes ordenados por fecha (FIFO) para un apartamento
export interface CreditoPendiente {
  id: string;
  monto: number;
  montoPagado: number;
  pendiente: number;
  categoria: string;
  fecha: string;
  descripcion: string | null;
}

export async function getCreditosPendientes(apartamentoId: string): Promise<CreditoPendiente[]> {
  const database = await getDatabase();

  const creditos = await database.select<{
    id: string;
    monto: number;
    montoPagado: number | null;
    categoria: string;
    fecha: string;
    descripcion: string | null;
  }[]>(`
    SELECT id, monto, COALESCE(montoPagado, 0) as montoPagado, categoria, fecha, descripcion
    FROM Transaccion
    WHERE apartamentoId = ?
      AND tipo = 'VENTA_CREDITO'
      AND (estadoCredito = 'PENDIENTE' OR estadoCredito = 'PARCIAL')
    ORDER BY fecha ASC
  `, [apartamentoId]);

  return creditos.map(c => ({
    ...c,
    montoPagado: c.montoPagado || 0,
    pendiente: c.monto - (c.montoPagado || 0),
  }));
}

// Interfaz para resultado de distribución de pago
export interface DistribucionPago {
  aplicadoGastosComunes: number;
  aplicadoFondoReserva: number;
  excedente: number;
  creditosActualizados: { id: string; montoAplicado: number; nuevoMontoPagado: number; nuevoEstado: string }[];
}

// Calcular distribución de pago FIFO (sin aplicar)
export async function calcularDistribucionPago(
  apartamentoId: string,
  montoTransferencia: number
): Promise<DistribucionPago> {
  const creditosPendientes = await getCreditosPendientes(apartamentoId);

  let montoRestante = montoTransferencia;
  let aplicadoGC = 0;
  let aplicadoFR = 0;
  const creditosActualizados: DistribucionPago['creditosActualizados'] = [];

  for (const credito of creditosPendientes) {
    if (montoRestante <= 0) break;

    const pendiente = credito.pendiente;
    const aplicar = Math.min(montoRestante, pendiente);

    if (credito.categoria === 'GASTOS_COMUNES') {
      aplicadoGC += aplicar;
    } else if (credito.categoria === 'FONDO_RESERVA') {
      aplicadoFR += aplicar;
    }

    const nuevoMontoPagado = credito.montoPagado + aplicar;
    const nuevoEstado = nuevoMontoPagado >= credito.monto ? 'PAGADO' : 'PARCIAL';

    creditosActualizados.push({
      id: credito.id,
      montoAplicado: aplicar,
      nuevoMontoPagado,
      nuevoEstado,
    });

    montoRestante -= aplicar;
  }

  return {
    aplicadoGastosComunes: aplicadoGC,
    aplicadoFondoReserva: aplicadoFR,
    excedente: montoRestante,
    creditosActualizados,
  };
}

// Crear recibo de pago con lógica de negocio y distribución FIFO
export async function createReciboPago(data: {
  monto: number;
  apartamentoId: string;
  fecha: string;
  metodoPago: string;
  cuentaBancariaId: string | null;
  referencia: string | null;
  notas: string | null;
  clasificacionPago: 'GASTO_COMUN' | 'FONDO_RESERVA';
  // Nuevos parámetros para distribución automática
  usarDistribucionAutomatica?: boolean;
  excedentePara?: 'GASTO_COMUN' | 'FONDO_RESERVA';
  // Montos pre-calculados (si vienen del frontend)
  montoGastoComun?: number;
  montoFondoReserva?: number;
}): Promise<Transaccion> {
  const apartamento = await getApartamentoById(data.apartamentoId);
  if (!apartamento) {
    throw new Error("Apartamento no encontrado");
  }

  // Calcular distribución automática si está habilitada
  let montoGC = data.montoGastoComun ?? 0;
  let montoFR = data.montoFondoReserva ?? 0;
  let clasificacionFinal: 'GASTO_COMUN' | 'FONDO_RESERVA' | 'MIXTO' = data.clasificacionPago;

  if (data.usarDistribucionAutomatica) {
    const distribucion = await calcularDistribucionPago(data.apartamentoId, data.monto);

    montoGC = distribucion.aplicadoGastosComunes;
    montoFR = distribucion.aplicadoFondoReserva;

    // Asignar excedente al concepto elegido
    if (distribucion.excedente > 0 && data.excedentePara) {
      if (data.excedentePara === 'GASTO_COMUN') {
        montoGC += distribucion.excedente;
      } else {
        montoFR += distribucion.excedente;
      }
    }

    // Determinar clasificación final
    if (montoGC > 0 && montoFR > 0) {
      clasificacionFinal = 'MIXTO';
    } else if (montoGC > 0) {
      clasificacionFinal = 'GASTO_COMUN';
    } else if (montoFR > 0) {
      clasificacionFinal = 'FONDO_RESERVA';
    }

    // Actualizar créditos pendientes con la distribución calculada
    for (const creditoActualizado of distribucion.creditosActualizados) {
      await updateTransaccion(creditoActualizado.id, {
        montoPagado: creditoActualizado.nuevoMontoPagado,
        estadoCredito: creditoActualizado.nuevoEstado,
      });
    }
  } else {
    // Modo legacy: usar clasificación simple
    montoGC = data.clasificacionPago === 'GASTO_COMUN' ? data.monto : 0;
    montoFR = data.clasificacionPago === 'FONDO_RESERVA' ? data.monto : 0;

    // Actualizar créditos pendientes de forma secuencial (modo legacy)
    const transacciones = await getTransaccionesByApartamento(data.apartamentoId);
    const pendingCredits = transacciones
      .filter(t => t.tipo === 'VENTA_CREDITO' && (t.estadoCredito === 'PENDIENTE' || t.estadoCredito === 'PARCIAL'))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    let remainingPayment = data.monto;

    for (const credit of pendingCredits) {
      if (remainingPayment <= 0) break;

      const pendingAmount = credit.monto - (credit.montoPagado || 0);
      const paymentToApply = Math.min(remainingPayment, pendingAmount);

      const newMontoPagado = (credit.montoPagado || 0) + paymentToApply;
      const newEstado = newMontoPagado >= credit.monto ? 'PAGADO' : 'PARCIAL';

      await updateTransaccion(credit.id, {
        montoPagado: newMontoPagado,
        estadoCredito: newEstado,
      });

      remainingPayment -= paymentToApply;
    }
  }

  const tipoOcupacionLabel = apartamento.tipoOcupacion === 'PROPIETARIO' ? 'Propietario' : 'Inquilino';
  const clasificacionLabel = clasificacionFinal === 'GASTO_COMUN' ? 'Gastos Comunes' : clasificacionFinal === 'FONDO_RESERVA' ? 'Fondo de Reserva' : 'Mixto';
  const descripcionRecibo = `Pago Apto ${apartamento.numero} (${tipoOcupacionLabel}) - ${clasificacionLabel}`;

  const recibo = await createTransaccion({
    tipo: 'RECIBO_PAGO',
    monto: data.monto,
    apartamentoId: data.apartamentoId,
    fecha: data.fecha,
    metodoPago: data.metodoPago,
    referencia: data.referencia,
    notas: data.notas,
    descripcion: descripcionRecibo,
    clasificacionPago: clasificacionFinal,
    montoGastoComun: montoGC > 0 ? montoGC : null,
    montoFondoReserva: montoFR > 0 ? montoFR : null,
    categoria: null,
    estadoCredito: null,
    montoPagado: null,
  });

  // Si se seleccionó una cuenta bancaria, crear el movimiento bancario
  if (data.cuentaBancariaId) {
    await createMovimientoBancario({
      tipo: 'INGRESO',
      monto: data.monto,
      fecha: data.fecha,
      descripcion: descripcionRecibo,
      referencia: data.referencia,
      cuentaBancariaId: data.cuentaBancariaId,
      transaccionId: recibo.id,
      numeroDocumento: null,
      archivoUrl: null,
      clasificacion: clasificacionFinal === 'MIXTO' ? null : (clasificacionFinal || null),
      conciliado: false,
      servicioId: null,
    });
  }

  return recibo;
}

// Actualizar recibo de pago con manejo de cuenta bancaria
export async function updateReciboPago(
  id: string,
  data: {
    monto?: number;
    apartamentoId?: string;
    fecha?: string;
    metodoPago?: string;
    cuentaBancariaId?: string | null;
    referencia?: string | null;
    notas?: string | null;
    clasificacionPago?: 'GASTO_COMUN' | 'FONDO_RESERVA';
  }
): Promise<Transaccion> {
  const transaccion = await getTransaccionById(id);
  if (!transaccion) {
    throw new Error("Transacción no encontrada");
  }

  if (transaccion.tipo !== 'RECIBO_PAGO') {
    throw new Error("Esta función solo aplica para recibos de pago");
  }

  // Actualizar la transacción
  const updateData: Record<string, unknown> = {};
  if (data.monto !== undefined) updateData.monto = data.monto;
  if (data.apartamentoId !== undefined) updateData.apartamentoId = data.apartamentoId;
  if (data.fecha !== undefined) updateData.fecha = data.fecha;
  if (data.metodoPago !== undefined) updateData.metodoPago = data.metodoPago;
  if (data.referencia !== undefined) updateData.referencia = data.referencia;
  if (data.notas !== undefined) updateData.notas = data.notas;
  if (data.clasificacionPago !== undefined) {
    updateData.clasificacionPago = data.clasificacionPago;
    updateData.montoGastoComun = data.clasificacionPago === 'GASTO_COMUN' ? (data.monto ?? transaccion.monto) : null;
    updateData.montoFondoReserva = data.clasificacionPago === 'FONDO_RESERVA' ? (data.monto ?? transaccion.monto) : null;
  }

  // Actualizar descripción de la transacción si cambia clasificación o apartamento
  if (data.clasificacionPago !== undefined || data.apartamentoId !== undefined) {
    const apartamentoIdParaDesc = data.apartamentoId ?? transaccion.apartamentoId;
    const apartamentoParaDesc = apartamentoIdParaDesc ? await getApartamentoById(apartamentoIdParaDesc) : null;
    const tipoOcupacionLabel = apartamentoParaDesc?.tipoOcupacion === 'PROPIETARIO' ? 'Propietario' : 'Inquilino';
    const clasificacionParaDesc = data.clasificacionPago ?? transaccion.clasificacionPago;
    const clasificacionLabel = clasificacionParaDesc === 'GASTO_COMUN' ? 'Gastos Comunes' : clasificacionParaDesc === 'FONDO_RESERVA' ? 'Fondo de Reserva' : 'Mixto';
    updateData.descripcion = apartamentoParaDesc
      ? `Pago Apto ${apartamentoParaDesc.numero} (${tipoOcupacionLabel}) - ${clasificacionLabel}`
      : 'Recibo de Pago';
  }

  const updatedTransaccion = await updateTransaccion(id, updateData);

  // Manejar el movimiento bancario
  const movimientoExistente = await getMovimientoBancarioByTransaccionId(id);

  if (data.cuentaBancariaId !== undefined) {
    // Se está cambiando la cuenta bancaria
    if (data.cuentaBancariaId === null || data.cuentaBancariaId === '') {
      // Si la nueva cuenta es null/vacía, eliminar el movimiento existente
      if (movimientoExistente) {
        await deleteMovimientoBancario(movimientoExistente.id);
      }
    } else if (movimientoExistente) {
      // Si ya existe un movimiento, actualizarlo con la nueva cuenta y datos
      const updateMovData: Record<string, unknown> = {
        cuentaBancariaId: data.cuentaBancariaId,
      };
      if (data.monto !== undefined) updateMovData.monto = data.monto;
      if (data.fecha !== undefined) updateMovData.fecha = data.fecha;
      if (data.referencia !== undefined) updateMovData.referencia = data.referencia;

      // Si cambió clasificación o apartamento, actualizar descripción y clasificación
      if (data.clasificacionPago !== undefined || data.apartamentoId !== undefined) {
        const apartamentoIdParaDesc = data.apartamentoId ?? transaccion.apartamentoId;
        const apartamentoParaDesc = apartamentoIdParaDesc ? await getApartamentoById(apartamentoIdParaDesc) : null;
        const tipoOcupacionLabel = apartamentoParaDesc?.tipoOcupacion === 'PROPIETARIO' ? 'Propietario' : 'Inquilino';
        const clasificacionParaDesc = data.clasificacionPago ?? transaccion.clasificacionPago;
        const clasificacionLabel = clasificacionParaDesc === 'GASTO_COMUN' ? 'Gastos Comunes' : clasificacionParaDesc === 'FONDO_RESERVA' ? 'Fondo de Reserva' : 'Mixto';
        updateMovData.descripcion = apartamentoParaDesc
          ? `Pago Apto ${apartamentoParaDesc.numero} (${tipoOcupacionLabel}) - ${clasificacionLabel}`
          : 'Recibo de Pago';
      }
      // Sincronizar clasificación al movimiento
      if (data.clasificacionPago !== undefined) {
        updateMovData.clasificacion = data.clasificacionPago;
      }

      await updateMovimientoBancario(movimientoExistente.id, updateMovData);
    } else {
      // Si no existe movimiento, crear uno nuevo
      const ref = data.referencia !== undefined ? data.referencia : transaccion.referencia;
      const apartamentoIdParaDesc = data.apartamentoId ?? transaccion.apartamentoId;
      const apartamentoParaDesc = apartamentoIdParaDesc ? await getApartamentoById(apartamentoIdParaDesc) : null;
      const tipoOcupacionLabel = apartamentoParaDesc?.tipoOcupacion === 'PROPIETARIO' ? 'Propietario' : 'Inquilino';
      const clasificacionParaDesc = data.clasificacionPago ?? transaccion.clasificacionPago;
      const clasificacionLabel = clasificacionParaDesc === 'GASTO_COMUN' ? 'Gastos Comunes' : clasificacionParaDesc === 'FONDO_RESERVA' ? 'Fondo de Reserva' : 'Mixto';
      const descripcionRecibo = apartamentoParaDesc
        ? `Pago Apto ${apartamentoParaDesc.numero} (${tipoOcupacionLabel}) - ${clasificacionLabel}`
        : 'Recibo de Pago';

      // Determinar clasificación para el nuevo movimiento
      const clasificacionNuevoMov = data.clasificacionPago ?? transaccion.clasificacionPago;
      await createMovimientoBancario({
        tipo: 'INGRESO',
        monto: data.monto ?? transaccion.monto,
        fecha: data.fecha ?? transaccion.fecha,
        descripcion: descripcionRecibo,
        referencia: ref,
        cuentaBancariaId: data.cuentaBancariaId,
        transaccionId: id,
        numeroDocumento: null,
        archivoUrl: null,
        clasificacion: clasificacionNuevoMov === 'MIXTO' ? null : (clasificacionNuevoMov || null),
        conciliado: false,
        servicioId: null,
      });
    }
  } else if (movimientoExistente) {
    // No se cambió la cuenta, pero hay movimiento existente - sincronizar otros campos
    const updateMovData: Record<string, unknown> = {};
    if (data.monto !== undefined) updateMovData.monto = data.monto;
    if (data.fecha !== undefined) updateMovData.fecha = data.fecha;
    if (data.referencia !== undefined) updateMovData.referencia = data.referencia;

    // Si cambió clasificación o apartamento, actualizar descripción
    if (data.clasificacionPago !== undefined || data.apartamentoId !== undefined) {
      const apartamentoIdParaDesc = data.apartamentoId ?? transaccion.apartamentoId;
      const apartamentoParaDesc = apartamentoIdParaDesc ? await getApartamentoById(apartamentoIdParaDesc) : null;
      const tipoOcupacionLabel = apartamentoParaDesc?.tipoOcupacion === 'PROPIETARIO' ? 'Propietario' : 'Inquilino';
      const clasificacionParaDesc = data.clasificacionPago ?? transaccion.clasificacionPago;
      const clasificacionLabel = clasificacionParaDesc === 'GASTO_COMUN' ? 'Gastos Comunes' : clasificacionParaDesc === 'FONDO_RESERVA' ? 'Fondo de Reserva' : 'Mixto';
      updateMovData.descripcion = apartamentoParaDesc
        ? `Pago Apto ${apartamentoParaDesc.numero} (${tipoOcupacionLabel}) - ${clasificacionLabel}`
        : 'Recibo de Pago';
    }
    // Sincronizar clasificación al movimiento
    if (data.clasificacionPago !== undefined) {
      updateMovData.clasificacion = data.clasificacionPago;
    }

    // Solo actualizar si hay campos para actualizar
    if (Object.keys(updateMovData).length > 0) {
      await updateMovimientoBancario(movimientoExistente.id, updateMovData);
    }
  }

  return updatedTransaccion;
}

// Vincular recibo con ingreso bancario
export async function vincularReciboConIngreso(
  transaccionId: string,
  cuentaBancariaId: string
): Promise<MovimientoBancario> {
  const transaccion = await getTransaccionById(transaccionId);
  if (!transaccion) {
    throw new Error("Transacción no encontrada");
  }

  if (transaccion.tipo !== 'RECIBO_PAGO') {
    throw new Error("Solo se pueden vincular recibos de pago");
  }

  const existente = await getMovimientoBancarioByTransaccionId(transaccionId);
  if (existente) {
    throw new Error("Este recibo ya está vinculado a un movimiento bancario");
  }

  const apartamento = transaccion.apartamentoId
    ? await getApartamentoById(transaccion.apartamentoId)
    : null;
  const tipoOcupacionLabel = apartamento?.tipoOcupacion === 'PROPIETARIO' ? 'Propietario' : 'Inquilino';
  const clasificacionLabel = transaccion.clasificacionPago === 'GASTO_COMUN' ? 'Gastos Comunes' : transaccion.clasificacionPago === 'FONDO_RESERVA' ? 'Fondo de Reserva' : 'Mixto';

  const movimiento = await createMovimientoBancario({
    tipo: 'INGRESO',
    monto: transaccion.monto,
    fecha: transaccion.fecha,
    descripcion: `Pago Apto ${apartamento?.numero || 'N/A'} (${tipoOcupacionLabel}) - ${clasificacionLabel}`,
    referencia: transaccion.referencia,
    cuentaBancariaId,
    transaccionId,
    numeroDocumento: null,
    archivoUrl: null,
    clasificacion: transaccion.clasificacionPago === 'MIXTO' ? null : (transaccion.clasificacionPago || null),
    conciliado: false,
    servicioId: null,
  });

  return movimiento;
}

// Estado de cuenta
export interface EstadoCuentaData {
  cuenta: {
    id: string;
    banco: string;
    tipoCuenta: string;
    numeroCuenta: string;
    titular: string | null;
    saldoInicial: number;
  };
  movimientos: {
    id: string;
    tipo: 'INGRESO' | 'EGRESO';
    monto: number;
    fecha: string;
    descripcion: string;
    referencia: string | null;
    clasificacion: string | null;
    saldoAcumulado: number;
  }[];
  resumen: {
    saldoInicial: number;
    totalIngresos: number;
    totalEgresos: number;
    saldoFinal: number;
  };
}

export async function getEstadoCuenta(
  cuentaId: string,
  fechaInicio?: string,
  fechaFin?: string
): Promise<EstadoCuentaData | null> {
  const cuenta = await getCuentaBancariaById(cuentaId);
  if (!cuenta) return null;

  let movimientos = await getMovimientosBancarios(cuentaId);

  // Filtrar por fechas si se proporcionan
  if (fechaInicio || fechaFin) {
    movimientos = movimientos.filter(m => {
      const fecha = new Date(m.fecha);
      if (fechaInicio && fecha < new Date(fechaInicio)) return false;
      if (fechaFin && fecha > new Date(fechaFin)) return false;
      return true;
    });
  }

  // Ordenar por fecha ascendente para calcular saldo acumulado
  movimientos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  let saldoAcumulado = cuenta.saldoInicial;
  const movimientosConSaldo = movimientos.map(mov => {
    if (mov.tipo === 'INGRESO') {
      saldoAcumulado += mov.monto;
    } else {
      saldoAcumulado -= mov.monto;
    }
    return {
      id: mov.id,
      tipo: mov.tipo,
      monto: mov.monto,
      fecha: mov.fecha,
      descripcion: mov.descripcion,
      referencia: mov.referencia,
      clasificacion: mov.clasificacion,
      saldoAcumulado,
    };
  });

  const totalIngresos = movimientos
    .filter(m => m.tipo === 'INGRESO')
    .reduce((sum, m) => sum + m.monto, 0);

  const totalEgresos = movimientos
    .filter(m => m.tipo === 'EGRESO')
    .reduce((sum, m) => sum + m.monto, 0);

  return {
    cuenta: {
      id: cuenta.id,
      banco: cuenta.banco,
      tipoCuenta: cuenta.tipoCuenta,
      numeroCuenta: cuenta.numeroCuenta,
      titular: cuenta.titular,
      saldoInicial: cuenta.saldoInicial,
    },
    movimientos: movimientosConSaldo,
    resumen: {
      saldoInicial: cuenta.saldoInicial,
      totalIngresos,
      totalEgresos,
      saldoFinal: cuenta.saldoInicial + totalIngresos - totalEgresos,
    },
  };
}

// ============ FUNCIONES PARA INFORMES ============

export interface InformeApartamentoData {
  apartamentoId: string;
  numero: string;
  piso: number | null;
  tipoOcupacion: 'PROPIETARIO' | 'INQUILINO';
  contactoNombre: string | null;
  contactoApellido: string | null;
  contactoCelular: string | null;
  saldoAnterior: number;
  pagosMes: number;
  gastosComunesMes: number;
  fondoReservaMes: number;
  saldoActual: number;
}

export interface ResumenBancario {
  ingresoGastosComunes: number;
  ingresoFondoReserva: number;
  egresoGastosComunes: number;
  egresoFondoReserva: number;
  saldoBancarioTotal: number;
}

export interface DetalleEgreso {
  fecha: string;
  servicio: string;
  descripcion: string;
  clasificacion: string;
  monto: number;
  banco: string;
}

export interface SaldoCuentaBancaria {
  id: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  titular: string | null;
  saldo: number;
}

export interface InformeData {
  fecha: string;
  apartamentos: InformeApartamentoData[];
  resumenBancario: ResumenBancario;
  saldosPorCuenta: SaldoCuentaBancaria[];
  detalleEgresos: DetalleEgreso[];
  totales: {
    totalSaldoAnterior: number;
    totalPagosMes: number;
    totalGastosComunesMes: number;
    totalFondoReservaMes: number;
    totalSaldoActual: number;
  };
  avisos: AvisoInforme[];
}

// Interfaces para informe combinado (mes anterior + mes corriente)
export interface InformeApartamentoCombinado {
  apartamentoId: string;
  numero: string;
  piso: number | null;
  tipoOcupacion: 'PROPIETARIO' | 'INQUILINO';
  contactoNombre: string | null;
  contactoApellido: string | null;
  contactoCelular: string | null;
  pagosMesAnterior: number;
  saldoMesAnterior: number;
  gastosComunesMesCorriente: number;
  fondoReservaMesCorriente: number;
  saldoActual: number;
}

export interface InformeCombinado {
  mesCorriente: { mes: number; anio: number; label: string };
  mesAnterior: { mes: number; anio: number; label: string };
  apartamentos: InformeApartamentoCombinado[];
  datosAnterior: {
    resumenBancario: ResumenBancario;
    saldosPorCuenta: SaldoCuentaBancaria[];
    detalleEgresos: DetalleEgreso[];
    totales: {
      totalSaldoAnterior: number;
      totalPagosMes: number;
      totalGastosComunesMes: number;
      totalFondoReservaMes: number;
      totalSaldoActual: number;
    };
  };
  totalesCombinados: {
    totalPagosMesAnterior: number;
    totalSaldoMesAnterior: number;
    totalGastosComunesMesCorriente: number;
    totalFondoReservaMesCorriente: number;
    totalSaldoActual: number;
  };
  avisos: AvisoInforme[];
}

export async function getInformeData(mes: number, anio: number): Promise<InformeData> {
  const fechaInicio = new Date(anio, mes - 1, 1);
  const fechaFin = new Date(anio, mes, 0, 23, 59, 59, 999);

  // Ejecutar todas las queries en paralelo
  const [apartamentos, todasTransacciones, movimientosBancarios, cuentasBancarias, avisos] = await Promise.all([
    getApartamentos(),
    getTransacciones(),
    getMovimientosBancariosCompletos(),
    getCuentasBancariasConMovimientos(),
    getAvisosInforme(mes, anio)
  ]);

  const informeApartamentos: InformeApartamentoData[] = [];

  for (const apt of apartamentos) {
    const transaccionesApt = todasTransacciones.filter(t => t.apartamentoId === apt.id);

    // Calcular saldo anterior
    const transaccionesAnteriores = transaccionesApt.filter(
      t => new Date(t.fecha) < fechaInicio
    );

    let saldoAnterior = 0;
    for (const t of transaccionesAnteriores) {
      if (t.tipo === 'VENTA_CREDITO') {
        saldoAnterior += t.monto;
      } else if (t.tipo === 'RECIBO_PAGO') {
        saldoAnterior -= t.monto;
      }
    }

    // Calcular pagos del mes
    const pagosMes = transaccionesApt
      .filter(t =>
        t.tipo === 'RECIBO_PAGO' &&
        new Date(t.fecha) >= fechaInicio &&
        new Date(t.fecha) <= fechaFin
      )
      .reduce((sum, t) => sum + t.monto, 0);

    // Calcular gastos comunes del mes
    const gastosComunesMes = transaccionesApt
      .filter(t =>
        t.tipo === 'VENTA_CREDITO' &&
        t.categoria === 'GASTOS_COMUNES' &&
        new Date(t.fecha) >= fechaInicio &&
        new Date(t.fecha) <= fechaFin
      )
      .reduce((sum, t) => sum + t.monto, 0);

    // Calcular fondo de reserva del mes
    const fondoReservaMes = transaccionesApt
      .filter(t =>
        t.tipo === 'VENTA_CREDITO' &&
        t.categoria === 'FONDO_RESERVA' &&
        new Date(t.fecha) >= fechaInicio &&
        new Date(t.fecha) <= fechaFin
      )
      .reduce((sum, t) => sum + t.monto, 0);

    const saldoActual = saldoAnterior + gastosComunesMes + fondoReservaMes - pagosMes;

    informeApartamentos.push({
      apartamentoId: apt.id,
      numero: apt.numero,
      piso: apt.piso,
      tipoOcupacion: apt.tipoOcupacion,
      contactoNombre: apt.contactoNombre,
      contactoApellido: apt.contactoApellido,
      contactoCelular: apt.contactoCelular,
      saldoAnterior,
      pagosMes,
      gastosComunesMes,
      fondoReservaMes,
      saldoActual,
    });
  }

  // Ordenar apartamentos
  informeApartamentos.sort((a, b) => {
    const numA = a.numero.localeCompare(b.numero, undefined, { numeric: true });
    if (numA !== 0) return numA;
    return a.tipoOcupacion.localeCompare(b.tipoOcupacion);
  });

  // Calcular resumen bancario
  const movimientosDelMes = movimientosBancarios.filter(m => {
    const fecha = new Date(m.fecha);
    return fecha >= fechaInicio && fecha <= fechaFin;
  });

  // Ingresos por categoría desde recibos de pago
  const recibosDelMes = todasTransacciones.filter(t =>
    t.tipo === 'RECIBO_PAGO' &&
    new Date(t.fecha) >= fechaInicio &&
    new Date(t.fecha) <= fechaFin
  );

  let ingresoGastosComunes = 0;
  let ingresoFondoReserva = 0;

  for (const recibo of recibosDelMes) {
    // Verificar si tiene movimiento bancario vinculado
    const tieneMovimiento = movimientosBancarios.some(m => m.transaccionId === recibo.id);
    if (!tieneMovimiento) continue;

    if (recibo.clasificacionPago === 'GASTO_COMUN') {
      ingresoGastosComunes += recibo.monto;
    } else if (recibo.clasificacionPago === 'FONDO_RESERVA') {
      ingresoFondoReserva += recibo.monto;
    } else {
      if (recibo.montoGastoComun) {
        ingresoGastosComunes += recibo.montoGastoComun;
      }
      if (recibo.montoFondoReserva) {
        ingresoFondoReserva += recibo.montoFondoReserva;
      }
      if (!recibo.montoGastoComun && !recibo.montoFondoReserva && !recibo.clasificacionPago) {
        ingresoGastosComunes += recibo.monto;
      }
    }
  }

  // Egresos por clasificación
  let egresoGastosComunes = 0;
  let egresoFondoReserva = 0;
  const detalleEgresos: DetalleEgreso[] = [];

  for (const mov of movimientosDelMes) {
    if (mov.tipo === 'EGRESO') {
      if (mov.clasificacion === 'GASTO_COMUN') {
        egresoGastosComunes += mov.monto;
      } else if (mov.clasificacion === 'FONDO_RESERVA') {
        egresoFondoReserva += mov.monto;
      }

      detalleEgresos.push({
        fecha: mov.fecha,
        servicio: mov.servicio?.nombre || '',
        descripcion: mov.descripcion || 'Sin descripción',
        clasificacion: mov.clasificacion || 'SIN_CLASIFICAR',
        monto: mov.monto,
        banco: mov.cuentaBancaria?.banco || 'N/A',
      });
    }
  }

  // Calcular saldo bancario total y saldos por cuenta
  let saldoBancarioTotal = 0;
  const saldosPorCuenta: SaldoCuentaBancaria[] = [];
  for (const cuenta of cuentasBancarias) {
    if (!cuenta.activa) continue;
    let saldo = cuenta.saldoInicial;
    for (const mov of cuenta.movimientos) {
      if (new Date(mov.fecha) <= fechaFin) {
        if (mov.tipo === 'INGRESO') {
          saldo += mov.monto;
        } else {
          saldo -= mov.monto;
        }
      }
    }
    saldoBancarioTotal += saldo;
    saldosPorCuenta.push({
      id: cuenta.id,
      banco: cuenta.banco,
      tipoCuenta: cuenta.tipoCuenta,
      numeroCuenta: cuenta.numeroCuenta,
      titular: cuenta.titular,
      saldo,
    });
  }

  // Calcular totales
  const totales = {
    totalSaldoAnterior: informeApartamentos.reduce((s, a) => s + a.saldoAnterior, 0),
    totalPagosMes: informeApartamentos.reduce((s, a) => s + a.pagosMes, 0),
    totalGastosComunesMes: informeApartamentos.reduce((s, a) => s + a.gastosComunesMes, 0),
    totalFondoReservaMes: informeApartamentos.reduce((s, a) => s + a.fondoReservaMes, 0),
    totalSaldoActual: informeApartamentos.reduce((s, a) => s + a.saldoActual, 0),
  };

  // Ordenar egresos por fecha
  detalleEgresos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  return {
    fecha: fechaFin.toISOString(),
    apartamentos: informeApartamentos,
    resumenBancario: {
      ingresoGastosComunes,
      ingresoFondoReserva,
      egresoGastosComunes,
      egresoFondoReserva,
      saldoBancarioTotal,
    },
    saldosPorCuenta,
    detalleEgresos,
    totales,
    avisos,
  };
}

const MESES_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export async function getInformeCombinado(
  mesCorriente: number,
  anioCorriente: number
): Promise<InformeCombinado> {
  // Calcular mes anterior
  let mesAnterior = mesCorriente - 1;
  let anioAnterior = anioCorriente;
  if (mesAnterior < 1) {
    mesAnterior = 12;
    anioAnterior = anioCorriente - 1;
  }

  // Definir rangos de fechas
  const fechaInicioAnterior = new Date(anioAnterior, mesAnterior - 1, 1);
  const fechaFinAnterior = new Date(anioAnterior, mesAnterior, 0, 23, 59, 59, 999);
  const fechaInicioCorriente = new Date(anioCorriente, mesCorriente - 1, 1);
  const fechaFinCorriente = new Date(anioCorriente, mesCorriente, 0, 23, 59, 59, 999);

  // Obtener datos base
  const [apartamentos, todasTransacciones, movimientosBancarios, cuentasBancarias, avisos] =
    await Promise.all([
      getApartamentos(),
      getTransacciones(),
      getMovimientosBancariosCompletos(),
      getCuentasBancariasConMovimientos(),
      getAvisosInforme(mesCorriente, anioCorriente)
    ]);

  const apartamentosCombinados: InformeApartamentoCombinado[] = [];

  for (const apt of apartamentos) {
    const transaccionesApt = todasTransacciones.filter(t => t.apartamentoId === apt.id);

    // 1. Calcular saldo AL INICIO del mes anterior (antes del mes anterior)
    const transaccionesAntesDelMesAnterior = transaccionesApt.filter(
      t => new Date(t.fecha) < fechaInicioAnterior
    );

    let saldoAntesDelMesAnterior = 0;
    for (const t of transaccionesAntesDelMesAnterior) {
      if (t.tipo === 'VENTA_CREDITO') {
        saldoAntesDelMesAnterior += t.monto;
      } else if (t.tipo === 'RECIBO_PAGO') {
        saldoAntesDelMesAnterior -= t.monto;
      }
    }

    // 2. Pagos del mes ANTERIOR
    const pagosMesAnterior = transaccionesApt
      .filter(t =>
        t.tipo === 'RECIBO_PAGO' &&
        new Date(t.fecha) >= fechaInicioAnterior &&
        new Date(t.fecha) <= fechaFinAnterior
      )
      .reduce((sum, t) => sum + t.monto, 0);

    // 3. Ventas/Deudas del mes ANTERIOR
    const gcMesAnterior = transaccionesApt
      .filter(t =>
        t.tipo === 'VENTA_CREDITO' &&
        t.categoria === 'GASTOS_COMUNES' &&
        new Date(t.fecha) >= fechaInicioAnterior &&
        new Date(t.fecha) <= fechaFinAnterior
      )
      .reduce((sum, t) => sum + t.monto, 0);

    const frMesAnterior = transaccionesApt
      .filter(t =>
        t.tipo === 'VENTA_CREDITO' &&
        t.categoria === 'FONDO_RESERVA' &&
        new Date(t.fecha) >= fechaInicioAnterior &&
        new Date(t.fecha) <= fechaFinAnterior
      )
      .reduce((sum, t) => sum + t.monto, 0);

    // 4. Saldo al FINAL del mes anterior
    const saldoMesAnterior = saldoAntesDelMesAnterior + gcMesAnterior + frMesAnterior - pagosMesAnterior;

    // 5. Ventas/Deudas del mes CORRIENTE
    const gastosComunesMesCorriente = transaccionesApt
      .filter(t =>
        t.tipo === 'VENTA_CREDITO' &&
        t.categoria === 'GASTOS_COMUNES' &&
        new Date(t.fecha) >= fechaInicioCorriente &&
        new Date(t.fecha) <= fechaFinCorriente
      )
      .reduce((sum, t) => sum + t.monto, 0);

    const fondoReservaMesCorriente = transaccionesApt
      .filter(t =>
        t.tipo === 'VENTA_CREDITO' &&
        t.categoria === 'FONDO_RESERVA' &&
        new Date(t.fecha) >= fechaInicioCorriente &&
        new Date(t.fecha) <= fechaFinCorriente
      )
      .reduce((sum, t) => sum + t.monto, 0);

    // 6. Saldo actual = Saldo mes anterior + ventas mes corriente
    const saldoActual = saldoMesAnterior + gastosComunesMesCorriente + fondoReservaMesCorriente;

    apartamentosCombinados.push({
      apartamentoId: apt.id,
      numero: apt.numero,
      piso: apt.piso,
      tipoOcupacion: apt.tipoOcupacion,
      contactoNombre: apt.contactoNombre,
      contactoApellido: apt.contactoApellido,
      contactoCelular: apt.contactoCelular,
      pagosMesAnterior,
      saldoMesAnterior,
      gastosComunesMesCorriente,
      fondoReservaMesCorriente,
      saldoActual,
    });
  }

  // Ordenar apartamentos
  apartamentosCombinados.sort((a, b) => {
    const numA = a.numero.localeCompare(b.numero, undefined, { numeric: true });
    if (numA !== 0) return numA;
    return a.tipoOcupacion.localeCompare(b.tipoOcupacion);
  });

  // Calcular datos del mes ANTERIOR para las secciones adicionales
  const movimientosDelMesAnterior = movimientosBancarios.filter(m => {
    const fecha = new Date(m.fecha);
    return fecha >= fechaInicioAnterior && fecha <= fechaFinAnterior;
  });

  // Ingresos del mes anterior por categoría
  const recibosDelMesAnterior = todasTransacciones.filter(t =>
    t.tipo === 'RECIBO_PAGO' &&
    new Date(t.fecha) >= fechaInicioAnterior &&
    new Date(t.fecha) <= fechaFinAnterior
  );

  let ingresoGastosComunesAnterior = 0;
  let ingresoFondoReservaAnterior = 0;

  for (const recibo of recibosDelMesAnterior) {
    const tieneMovimiento = movimientosBancarios.some(m => m.transaccionId === recibo.id);
    if (!tieneMovimiento) continue;

    if (recibo.clasificacionPago === 'GASTO_COMUN') {
      ingresoGastosComunesAnterior += recibo.monto;
    } else if (recibo.clasificacionPago === 'FONDO_RESERVA') {
      ingresoFondoReservaAnterior += recibo.monto;
    } else {
      if (recibo.montoGastoComun) {
        ingresoGastosComunesAnterior += recibo.montoGastoComun;
      }
      if (recibo.montoFondoReserva) {
        ingresoFondoReservaAnterior += recibo.montoFondoReserva;
      }
      if (!recibo.montoGastoComun && !recibo.montoFondoReserva && !recibo.clasificacionPago) {
        ingresoGastosComunesAnterior += recibo.monto;
      }
    }
  }

  // Egresos del mes anterior por clasificación
  let egresoGastosComunesAnterior = 0;
  let egresoFondoReservaAnterior = 0;
  const detalleEgresosAnterior: DetalleEgreso[] = [];

  for (const mov of movimientosDelMesAnterior) {
    if (mov.tipo === 'EGRESO') {
      if (mov.clasificacion === 'GASTO_COMUN') {
        egresoGastosComunesAnterior += mov.monto;
      } else if (mov.clasificacion === 'FONDO_RESERVA') {
        egresoFondoReservaAnterior += mov.monto;
      }

      detalleEgresosAnterior.push({
        fecha: mov.fecha,
        servicio: mov.servicio?.nombre || '',
        descripcion: mov.descripcion || 'Sin descripción',
        clasificacion: mov.clasificacion || 'SIN_CLASIFICAR',
        monto: mov.monto,
        banco: mov.cuentaBancaria?.banco || 'N/A',
      });
    }
  }

  // Calcular saldo bancario total y saldos por cuenta al final del mes anterior
  let saldoBancarioTotalAnterior = 0;
  const saldosPorCuentaAnterior: SaldoCuentaBancaria[] = [];
  for (const cuenta of cuentasBancarias) {
    if (!cuenta.activa) continue;
    let saldo = cuenta.saldoInicial;
    for (const mov of cuenta.movimientos) {
      if (new Date(mov.fecha) <= fechaFinAnterior) {
        if (mov.tipo === 'INGRESO') {
          saldo += mov.monto;
        } else {
          saldo -= mov.monto;
        }
      }
    }
    saldoBancarioTotalAnterior += saldo;
    saldosPorCuentaAnterior.push({
      id: cuenta.id,
      banco: cuenta.banco,
      tipoCuenta: cuenta.tipoCuenta,
      numeroCuenta: cuenta.numeroCuenta,
      titular: cuenta.titular,
      saldo,
    });
  }

  // Calcular totales del mes anterior
  const totalSaldoAnteriorDelMesAnterior = apartamentosCombinados.reduce((s, a) => {
    // Recalcular saldo anterior del mes anterior para cada apto
    const transApt = todasTransacciones.filter(t => t.apartamentoId === a.apartamentoId);
    const transAntesMesAnt = transApt.filter(t => new Date(t.fecha) < fechaInicioAnterior);
    let saldoAnt = 0;
    for (const t of transAntesMesAnt) {
      if (t.tipo === 'VENTA_CREDITO') saldoAnt += t.monto;
      else if (t.tipo === 'RECIBO_PAGO') saldoAnt -= t.monto;
    }
    return s + saldoAnt;
  }, 0);

  const totalPagosMesAnterior = apartamentosCombinados.reduce((s, a) => s + a.pagosMesAnterior, 0);

  const totalGcMesAnterior = todasTransacciones
    .filter(t =>
      t.tipo === 'VENTA_CREDITO' &&
      t.categoria === 'GASTOS_COMUNES' &&
      new Date(t.fecha) >= fechaInicioAnterior &&
      new Date(t.fecha) <= fechaFinAnterior
    )
    .reduce((sum, t) => sum + t.monto, 0);

  const totalFrMesAnterior = todasTransacciones
    .filter(t =>
      t.tipo === 'VENTA_CREDITO' &&
      t.categoria === 'FONDO_RESERVA' &&
      new Date(t.fecha) >= fechaInicioAnterior &&
      new Date(t.fecha) <= fechaFinAnterior
    )
    .reduce((sum, t) => sum + t.monto, 0);

  const totalSaldoActualMesAnterior = totalSaldoAnteriorDelMesAnterior + totalGcMesAnterior + totalFrMesAnterior - totalPagosMesAnterior;

  // Ordenar egresos por fecha
  detalleEgresosAnterior.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  return {
    mesCorriente: {
      mes: mesCorriente,
      anio: anioCorriente,
      label: `${MESES_LABELS[mesCorriente - 1]} ${anioCorriente}`
    },
    mesAnterior: {
      mes: mesAnterior,
      anio: anioAnterior,
      label: `${MESES_LABELS[mesAnterior - 1]} ${anioAnterior}`
    },
    apartamentos: apartamentosCombinados,
    datosAnterior: {
      resumenBancario: {
        ingresoGastosComunes: ingresoGastosComunesAnterior,
        ingresoFondoReserva: ingresoFondoReservaAnterior,
        egresoGastosComunes: egresoGastosComunesAnterior,
        egresoFondoReserva: egresoFondoReservaAnterior,
        saldoBancarioTotal: saldoBancarioTotalAnterior,
      },
      saldosPorCuenta: saldosPorCuentaAnterior,
      detalleEgresos: detalleEgresosAnterior,
      totales: {
        totalSaldoAnterior: totalSaldoAnteriorDelMesAnterior,
        totalPagosMes: totalPagosMesAnterior,
        totalGastosComunesMes: totalGcMesAnterior,
        totalFondoReservaMes: totalFrMesAnterior,
        totalSaldoActual: totalSaldoActualMesAnterior,
      },
    },
    totalesCombinados: {
      totalPagosMesAnterior: apartamentosCombinados.reduce((s, a) => s + a.pagosMesAnterior, 0),
      totalSaldoMesAnterior: apartamentosCombinados.reduce((s, a) => s + a.saldoMesAnterior, 0),
      totalGastosComunesMesCorriente: apartamentosCombinados.reduce((s, a) => s + a.gastosComunesMesCorriente, 0),
      totalFondoReservaMesCorriente: apartamentosCombinados.reduce((s, a) => s + a.fondoReservaMesCorriente, 0),
      totalSaldoActual: apartamentosCombinados.reduce((s, a) => s + a.saldoActual, 0),
    },
    avisos,
  };
}

export interface InformeAcumuladoData {
  fechaInicio: string;
  fechaFin: string;
  recibos: {
    gastosComunes: number;
    fondoReserva: number;
    total: number;
  };
  egresos: {
    gastosComunes: number;
    fondoReserva: number;
    total: number;
  };
  balance: {
    gastosComunes: number;
    fondoReserva: number;
    total: number;
  };
}

export async function getInformeAcumulado(
  fechaInicioStr: string,
  fechaFinStr: string
): Promise<InformeAcumuladoData> {
  const fechaInicio = new Date(fechaInicioStr);
  fechaInicio.setHours(0, 0, 0, 0);

  const fechaFin = new Date(fechaFinStr);
  fechaFin.setHours(23, 59, 59, 999);

  const todasTransacciones = await getTransacciones();
  const todosMovimientos = await getMovimientosBancarios();

  // Filtrar recibos de pago en el rango
  const recibos = todasTransacciones.filter(t =>
    t.tipo === 'RECIBO_PAGO' &&
    new Date(t.fecha) >= fechaInicio &&
    new Date(t.fecha) <= fechaFin
  );

  let recibosGastosComunes = 0;
  let recibosFondoReserva = 0;

  for (const recibo of recibos) {
    if (recibo.clasificacionPago === 'GASTO_COMUN') {
      recibosGastosComunes += recibo.monto;
    } else if (recibo.clasificacionPago === 'FONDO_RESERVA') {
      recibosFondoReserva += recibo.monto;
    } else {
      if (recibo.montoGastoComun) {
        recibosGastosComunes += recibo.montoGastoComun;
      }
      if (recibo.montoFondoReserva) {
        recibosFondoReserva += recibo.montoFondoReserva;
      }
      if (!recibo.montoGastoComun && !recibo.montoFondoReserva && !recibo.clasificacionPago) {
        recibosGastosComunes += recibo.monto;
      }
    }
  }

  // Filtrar egresos en el rango
  const egresos = todosMovimientos.filter(m =>
    m.tipo === 'EGRESO' &&
    new Date(m.fecha) >= fechaInicio &&
    new Date(m.fecha) <= fechaFin
  );

  let egresosGastosComunes = 0;
  let egresosFondoReserva = 0;

  for (const egreso of egresos) {
    if (egreso.clasificacion === 'GASTO_COMUN') {
      egresosGastosComunes += egreso.monto;
    } else if (egreso.clasificacion === 'FONDO_RESERVA') {
      egresosFondoReserva += egreso.monto;
    }
  }

  const totalRecibos = recibosGastosComunes + recibosFondoReserva;
  const totalEgresos = egresosGastosComunes + egresosFondoReserva;

  // Redondear a 2 decimales para evitar errores de punto flotante
  const roundTo2 = (n: number) => Math.round(n * 100) / 100;

  return {
    fechaInicio: fechaInicio.toISOString(),
    fechaFin: fechaFin.toISOString(),
    recibos: {
      gastosComunes: roundTo2(recibosGastosComunes),
      fondoReserva: roundTo2(recibosFondoReserva),
      total: roundTo2(totalRecibos),
    },
    egresos: {
      gastosComunes: roundTo2(egresosGastosComunes),
      fondoReserva: roundTo2(egresosFondoReserva),
      total: roundTo2(totalEgresos),
    },
    balance: {
      gastosComunes: roundTo2(recibosGastosComunes - egresosGastosComunes),
      fondoReserva: roundTo2(recibosFondoReserva - egresosFondoReserva),
      total: roundTo2(totalRecibos - totalEgresos),
    },
  };
}

// Pie de página del informe
const PIE_PAGINA_KEY = 'pie_pagina_informe';
const PIE_PAGINA_DEFAULT = 'Sistema de Administración de Edificios';

export async function getPiePaginaInforme(): Promise<string> {
  const config = await getConfiguracionInforme(PIE_PAGINA_KEY);
  return config?.valor ?? PIE_PAGINA_DEFAULT;
}

export async function updatePiePaginaInforme(valor: string): Promise<string> {
  const config = await setConfiguracionInforme(PIE_PAGINA_KEY, valor);
  return config.valor;
}

// Aviso final del informe (nota al final del PDF)
const AVISO_FINAL_KEY = 'aviso_final_informe';

export async function getAvisoFinalInforme(): Promise<string> {
  const config = await getConfiguracionInforme(AVISO_FINAL_KEY);
  return config?.valor ?? '';
}

export async function updateAvisoFinalInforme(valor: string): Promise<string> {
  const config = await setConfiguracionInforme(AVISO_FINAL_KEY, valor);
  return config.valor;
}

// ============ RECIBOS NO VINCULADOS ============

export interface ReciboNoVinculado {
  id: string;
  tipo: string;
  monto: number;
  fecha: string;
  descripcion: string | null;
  referencia: string | null;
  metodoPago: string | null;
  apartamento?: {
    numero: string;
    tipoOcupacion: string;
  } | null;
}

export async function getRecibosNoVinculados(): Promise<ReciboNoVinculado[]> {
  const database = await getDatabase();

  // Ejecutar queries en paralelo
  const [transacciones, movimientos, apartamentos] = await Promise.all([
    database.select<Transaccion[]>("SELECT * FROM Transaccion WHERE tipo = 'RECIBO_PAGO' ORDER BY fecha DESC"),
    database.select<{ transaccionId: string }[]>('SELECT transaccionId FROM MovimientoBancario WHERE transaccionId IS NOT NULL'),
    database.select<Apartamento[]>('SELECT id, numero, tipoOcupacion FROM Apartamento')
  ]);

  // IDs de transacciones que ya tienen movimiento vinculado
  const transaccionesVinculadas = new Set(movimientos.map(m => m.transaccionId));

  const apartamentosMap = new Map(apartamentos.map(a => [a.id, { numero: a.numero, tipoOcupacion: a.tipoOcupacion }]));

  return transacciones
    .filter(t => !transaccionesVinculadas.has(t.id))
    .map(t => ({
      id: t.id,
      tipo: t.tipo,
      monto: t.monto,
      fecha: t.fecha,
      descripcion: t.descripcion,
      referencia: t.referencia,
      metodoPago: t.metodoPago,
      apartamento: t.apartamentoId ? apartamentosMap.get(t.apartamentoId) : null,
    }));
}

// ============ FUNCIONES PARA DASHBOARD ============

export interface DashboardData {
  totalUnidades: number;
  totalRegistros: number;
  propietarios: number;
  inquilinosRegistrados: number;
  unidadesConAmbos: number;
  inquilinosActivos: number;
  gastosPropietarios: number;
  gastosInquilinos: number;
  recaudadoPropietarios: number;
  recaudadoInquilinos: number;
  ingresos: number;
  egresos: number;
  balance: number;
  creditosPendientes: number;
  recaudadoGastosComunes: number;
  recaudadoFondoReserva: number;
  transaccionesRecientes: TransaccionConApartamento[];
  apartamentos: Apartamento[];
  saldos: Record<string, number>;
}

export async function getDashboardData(): Promise<DashboardData> {
  // Ejecutar todas las queries en paralelo
  const [apartamentos, todasTransacciones, transaccionesRecientes, saldos] = await Promise.all([
    getApartamentosOrdenados(),
    getTransacciones(),
    getTransaccionesRecientes(10),
    obtenerSaldosCuentaCorriente()
  ]);

  // Contar unidades únicas y tipos
  const unidadesUnicas = new Set(apartamentos.map(a => a.numero));
  const totalUnidades = unidadesUnicas.size;
  const propietariosData = apartamentos.filter(a => a.tipoOcupacion === 'PROPIETARIO');
  const inquilinosData = apartamentos.filter(a => a.tipoOcupacion === 'INQUILINO');

  // Contar unidades que tienen ambos registros (P/I)
  const unidadesConAmbos = Array.from(unidadesUnicas).filter(numero => {
    const registros = apartamentos.filter(a => a.numero === numero);
    return registros.some(r => r.tipoOcupacion === 'PROPIETARIO') &&
           registros.some(r => r.tipoOcupacion === 'INQUILINO');
  }).length;

  // Calcular gastos totales por tipo (lo esperado)
  const gastosPropietarios = propietariosData.reduce((acc, a) =>
    acc + a.gastosComunes + a.fondoReserva, 0);
  const gastosInquilinos = inquilinosData.reduce((acc, a) =>
    acc + a.gastosComunes + a.fondoReserva, 0);

  // Crear mapa de apartamentoId -> tipoOcupacion para buscar rápido
  const apartamentoTipoMap = new Map<string, 'PROPIETARIO' | 'INQUILINO'>();
  for (const apt of apartamentos) {
    apartamentoTipoMap.set(apt.id, apt.tipoOcupacion);
  }

  // Filtrar recibos del mes actual
  const ahora = new Date();
  const mesActual = ahora.getMonth();
  const anioActual = ahora.getFullYear();

  const esDelMesActual = (fecha: string) => {
    const fechaRecibo = new Date(fecha);
    return fechaRecibo.getMonth() === mesActual && fechaRecibo.getFullYear() === anioActual;
  };

  // Calcular recaudado por tipo de ocupación (recibos de pago del mes actual)
  const recibosDelMes = todasTransacciones.filter(
    t => t.tipo === 'RECIBO_PAGO' && esDelMesActual(t.fecha)
  );

  const recibosConApartamentoDelMes = recibosDelMes.filter(t => t.apartamentoId);

  let recaudadoPropietarios = 0;
  let recaudadoInquilinos = 0;

  for (const recibo of recibosConApartamentoDelMes) {
    const tipoOcupacion = apartamentoTipoMap.get(recibo.apartamentoId!);
    if (tipoOcupacion === 'PROPIETARIO') {
      recaudadoPropietarios += recibo.monto;
    } else if (tipoOcupacion === 'INQUILINO') {
      recaudadoInquilinos += recibo.monto;
    }
  }

  // Calcular ingresos
  const ingresos = todasTransacciones
    .filter(t => t.tipo === 'INGRESO' || t.tipo === 'RECIBO_PAGO')
    .reduce((acc, t) => acc + t.monto, 0);

  const egresos = todasTransacciones
    .filter(t => t.tipo === 'EGRESO')
    .reduce((acc, t) => acc + t.monto, 0);

  const creditosPendientes = todasTransacciones
    .filter(t => t.tipo === 'VENTA_CREDITO' && t.estadoCredito !== 'PAGADO')
    .reduce((acc, t) => acc + (t.monto - (t.montoPagado || 0)), 0);

  // Calcular totales recaudados por tipo de pago (del mes actual)
  let recaudadoGastosComunes = 0;
  let recaudadoFondoReserva = 0;

  for (const recibo of recibosDelMes) {
    if (recibo.clasificacionPago === 'GASTO_COMUN') {
      recaudadoGastosComunes += recibo.monto;
    } else if (recibo.clasificacionPago === 'FONDO_RESERVA') {
      recaudadoFondoReserva += recibo.monto;
    } else {
      // Clasificación MIXTO o tiene montos específicos
      if (recibo.montoGastoComun) {
        recaudadoGastosComunes += recibo.montoGastoComun;
      }
      if (recibo.montoFondoReserva) {
        recaudadoFondoReserva += recibo.montoFondoReserva;
      }
      // Si no hay clasificación ni montos específicos, asumir gasto común
      if (!recibo.montoGastoComun && !recibo.montoFondoReserva && !recibo.clasificacionPago) {
        recaudadoGastosComunes += recibo.monto;
      }
    }
  }

  const balance = ingresos - egresos;

  return {
    totalUnidades,
    totalRegistros: apartamentos.length,
    propietarios: propietariosData.length,
    inquilinosRegistrados: inquilinosData.length,
    unidadesConAmbos,
    inquilinosActivos: inquilinosData.length,
    gastosPropietarios,
    gastosInquilinos,
    recaudadoPropietarios,
    recaudadoInquilinos,
    ingresos,
    egresos,
    balance,
    creditosPendientes,
    recaudadoGastosComunes,
    recaudadoFondoReserva,
    transaccionesRecientes,
    apartamentos,
    saldos,
  };
}

// ==================== ANÁLISIS DE EGRESOS ====================

export interface AnalisisEgresoItem {
  servicioId: string | null;
  servicioNombre: string;
  servicioColor: string;
  cantidad: number;
  montoTotal: number;
  detalles: {
    id: string;
    fecha: string;
    descripcion: string;
    monto: number;
    clasificacion: string;
    banco: string;
  }[];
}

export interface AnalisisData {
  mes: number;
  anio: number;
  clasificacion: 'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS';
  servicioFiltro: string | null;
  items: AnalisisEgresoItem[];
  totales: {
    cantidadTotal: number;
    montoTotal: number;
    montoGastoComun: number;
    montoFondoReserva: number;
  };
}

export async function getAnalisisData(
  mes: number,
  anio: number,
  clasificacion: 'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS' = 'AMBOS',
  servicioId: string | null = null
): Promise<AnalisisData> {
  const fechaInicio = new Date(anio, mes - 1, 1);
  const fechaFin = new Date(anio, mes, 0, 23, 59, 59, 999);

  // Obtener movimientos bancarios, servicios y tipos de servicio
  const [movimientos, servicios, tiposServicio] = await Promise.all([
    getMovimientosBancariosCompletos(),
    getServicios(),
    getTiposServicioActivos()
  ]);

  // Crear mapas para buscar servicios y tipos de servicio
  const serviciosMap = new Map(servicios.map(s => [s.id, s]));
  const tiposServicioMap = new Map(tiposServicio.map(t => [t.id, t]));

  // Filtrar egresos del mes
  let egresosDelMes = movimientos.filter(m => {
    const fecha = new Date(m.fecha);
    return m.tipo === 'EGRESO' &&
           fecha >= fechaInicio &&
           fecha <= fechaFin;
  });

  // Filtrar por clasificación
  if (clasificacion !== 'AMBOS') {
    egresosDelMes = egresosDelMes.filter(m => m.clasificacion === clasificacion);
  }

  // Filtrar por servicio si se especifica
  if (servicioId) {
    egresosDelMes = egresosDelMes.filter(m => m.servicioId === servicioId);
  }

  // Agrupar por servicio
  const agrupado = new Map<string | null, AnalisisEgresoItem>();

  for (const egreso of egresosDelMes) {
    const key = egreso.servicioId || 'SIN_SERVICIO';

    if (!agrupado.has(key)) {
      // Obtener el servicio y su tipo para conseguir el color
      const servicio = egreso.servicioId ? serviciosMap.get(egreso.servicioId) : null;
      const tipoServicio = servicio ? tiposServicioMap.get(servicio.tipo) : null;

      agrupado.set(key, {
        servicioId: egreso.servicioId,
        servicioNombre: egreso.servicio?.nombre || 'Sin servicio asignado',
        servicioColor: tipoServicio?.color || 'default',
        cantidad: 0,
        montoTotal: 0,
        detalles: [],
      });
    }

    const item = agrupado.get(key)!;
    item.cantidad++;
    item.montoTotal += egreso.monto;
    item.detalles.push({
      id: egreso.id,
      fecha: egreso.fecha,
      descripcion: egreso.descripcion || 'Sin descripción',
      monto: egreso.monto,
      clasificacion: egreso.clasificacion || 'SIN_CLASIFICAR',
      banco: egreso.cuentaBancaria?.banco || 'N/A',
    });
  }

  // Ordenar detalles por fecha dentro de cada grupo
  Array.from(agrupado.values()).forEach(item => {
    item.detalles.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  });

  // Convertir a array y ordenar por monto total descendente
  const items = Array.from(agrupado.values()).sort((a, b) => b.montoTotal - a.montoTotal);

  // Calcular totales
  const totales = {
    cantidadTotal: egresosDelMes.length,
    montoTotal: egresosDelMes.reduce((sum, e) => sum + e.monto, 0),
    montoGastoComun: egresosDelMes
      .filter(e => e.clasificacion === 'GASTO_COMUN')
      .reduce((sum, e) => sum + e.monto, 0),
    montoFondoReserva: egresosDelMes
      .filter(e => e.clasificacion === 'FONDO_RESERVA')
      .reduce((sum, e) => sum + e.monto, 0),
  };

  return {
    mes,
    anio,
    clasificacion,
    servicioFiltro: servicioId,
    items,
    totales,
  };
}

// Obtener análisis de egresos por rango de fechas
export interface AnalisisDataRango {
  fechaInicio: string;
  fechaFin: string;
  clasificacion: 'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS';
  servicioFiltro: string | null;
  items: AnalisisEgresoItem[];
  totales: {
    cantidadTotal: number;
    montoTotal: number;
    montoGastoComun: number;
    montoFondoReserva: number;
  };
}

export async function getAnalisisDataPorRango(
  fechaInicioStr: string,
  fechaFinStr: string,
  clasificacion: 'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS' = 'AMBOS',
  servicioId: string | null = null
): Promise<AnalisisDataRango> {
  const fechaInicio = new Date(fechaInicioStr);
  fechaInicio.setHours(0, 0, 0, 0);
  const fechaFin = new Date(fechaFinStr);
  fechaFin.setHours(23, 59, 59, 999);

  const [movimientos, servicios, tiposServicio] = await Promise.all([
    getMovimientosBancariosCompletos(),
    getServicios(),
    getTiposServicioActivos()
  ]);

  const serviciosMap = new Map(servicios.map(s => [s.id, s]));
  const tiposServicioMap = new Map(tiposServicio.map(t => [t.id, t]));

  let egresosDelPeriodo = movimientos.filter(m => {
    const fecha = new Date(m.fecha);
    return m.tipo === 'EGRESO' &&
           fecha >= fechaInicio &&
           fecha <= fechaFin;
  });

  if (clasificacion !== 'AMBOS') {
    egresosDelPeriodo = egresosDelPeriodo.filter(m => m.clasificacion === clasificacion);
  }

  if (servicioId) {
    egresosDelPeriodo = egresosDelPeriodo.filter(m => m.servicioId === servicioId);
  }

  const agrupado = new Map<string | null, AnalisisEgresoItem>();

  for (const egreso of egresosDelPeriodo) {
    const key = egreso.servicioId || 'SIN_SERVICIO';

    if (!agrupado.has(key)) {
      const servicio = egreso.servicioId ? serviciosMap.get(egreso.servicioId) : null;
      const tipoServicio = servicio ? tiposServicioMap.get(servicio.tipo) : null;

      agrupado.set(key, {
        servicioId: egreso.servicioId,
        servicioNombre: egreso.servicio?.nombre || 'Sin servicio asignado',
        servicioColor: tipoServicio?.color || 'default',
        cantidad: 0,
        montoTotal: 0,
        detalles: [],
      });
    }

    const item = agrupado.get(key)!;
    item.cantidad++;
    item.montoTotal += egreso.monto;
    item.detalles.push({
      id: egreso.id,
      fecha: egreso.fecha,
      descripcion: egreso.descripcion || 'Sin descripción',
      monto: egreso.monto,
      clasificacion: egreso.clasificacion || 'SIN_CLASIFICAR',
      banco: egreso.cuentaBancaria?.banco || 'N/A',
    });
  }

  Array.from(agrupado.values()).forEach(item => {
    item.detalles.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  });

  const items = Array.from(agrupado.values()).sort((a, b) => b.montoTotal - a.montoTotal);

  const totales = {
    cantidadTotal: egresosDelPeriodo.length,
    montoTotal: egresosDelPeriodo.reduce((sum, e) => sum + e.monto, 0),
    montoGastoComun: egresosDelPeriodo
      .filter(e => e.clasificacion === 'GASTO_COMUN')
      .reduce((sum, e) => sum + e.monto, 0),
    montoFondoReserva: egresosDelPeriodo
      .filter(e => e.clasificacion === 'FONDO_RESERVA')
      .reduce((sum, e) => sum + e.monto, 0),
  };

  return {
    fechaInicio: fechaInicioStr,
    fechaFin: fechaFinStr,
    clasificacion,
    servicioFiltro: servicioId,
    items,
    totales,
  };
}

// Obtener servicios que tienen actividad (egresos) en un período
export async function getServiciosConActividad(
  fechaInicioStr: string,
  fechaFinStr: string
): Promise<TipoServicio[]> {
  const fechaInicio = new Date(fechaInicioStr);
  fechaInicio.setHours(0, 0, 0, 0);
  const fechaFin = new Date(fechaFinStr);
  fechaFin.setHours(23, 59, 59, 999);

  const [movimientos, servicios, tiposServicio] = await Promise.all([
    getMovimientosBancariosCompletos(),
    getServicios(),
    getTiposServicioActivos()
  ]);

  // Filtrar egresos del período
  const egresosDelPeriodo = movimientos.filter(m => {
    const fecha = new Date(m.fecha);
    return m.tipo === 'EGRESO' &&
           fecha >= fechaInicio &&
           fecha <= fechaFin;
  });

  // Obtener IDs únicos de servicios con actividad
  const serviciosConActividad = new Set<string>();
  for (const egreso of egresosDelPeriodo) {
    if (egreso.servicioId) {
      const servicio = servicios.find(s => s.id === egreso.servicioId);
      if (servicio) {
        serviciosConActividad.add(servicio.tipo);
      }
    }
  }

  // Filtrar tipos de servicio que tienen actividad
  return tiposServicio.filter(t => serviciosConActividad.has(t.id));
}

// Interfaz para el reporte detallado por servicio y mes
export interface AnalisisPorServicioMesItem {
  mes: number;
  anio: number;
  mesLabel: string;
  monto: number;
  cantidad: number;
}

export interface AnalisisPorServicioMes {
  servicioId: string;
  servicioNombre: string;
  servicioColor: string;
  fechaInicio: string;
  fechaFin: string;
  meses: AnalisisPorServicioMesItem[];
  total: number;
  cantidadTotal: number;
}

export interface AnalisisDetalladoServicios {
  fechaInicio: string;
  fechaFin: string;
  clasificacion: 'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS';
  servicios: AnalisisPorServicioMes[];
  totalesPorMes: AnalisisPorServicioMesItem[];
  totalGeneral: number;
}

const mesesNombres = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export async function getAnalisisDetalladoPorServicioMes(
  fechaInicioStr: string,
  fechaFinStr: string,
  clasificacion: 'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS' = 'AMBOS'
): Promise<AnalisisDetalladoServicios> {
  const fechaInicio = new Date(fechaInicioStr);
  fechaInicio.setHours(0, 0, 0, 0);
  const fechaFin = new Date(fechaFinStr);
  fechaFin.setHours(23, 59, 59, 999);

  const [movimientos, servicios, tiposServicio] = await Promise.all([
    getMovimientosBancariosCompletos(),
    getServicios(),
    getTiposServicioActivos()
  ]);

  const serviciosMap = new Map(servicios.map(s => [s.id, s]));
  const tiposServicioMap = new Map(tiposServicio.map(t => [t.id, t]));

  // Filtrar egresos del período
  let egresosDelPeriodo = movimientos.filter(m => {
    const fecha = new Date(m.fecha);
    return m.tipo === 'EGRESO' &&
           fecha >= fechaInicio &&
           fecha <= fechaFin;
  });

  if (clasificacion !== 'AMBOS') {
    egresosDelPeriodo = egresosDelPeriodo.filter(m => m.clasificacion === clasificacion);
  }

  // Generar lista de meses en el rango
  const mesesEnRango: { mes: number; anio: number; label: string }[] = [];
  const current = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), 1);
  const end = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), 1);

  while (current <= end) {
    mesesEnRango.push({
      mes: current.getMonth() + 1,
      anio: current.getFullYear(),
      label: `${mesesNombres[current.getMonth()]} ${current.getFullYear()}`
    });
    current.setMonth(current.getMonth() + 1);
  }

  // Agrupar por servicio y mes
  const porServicio = new Map<string, Map<string, { monto: number; cantidad: number }>>();

  for (const egreso of egresosDelPeriodo) {
    const fecha = new Date(egreso.fecha);
    const mesKey = `${fecha.getMonth() + 1}-${fecha.getFullYear()}`;
    const servicioKey = egreso.servicioId || 'SIN_SERVICIO';

    if (!porServicio.has(servicioKey)) {
      porServicio.set(servicioKey, new Map());
    }

    const mesesServicio = porServicio.get(servicioKey)!;
    if (!mesesServicio.has(mesKey)) {
      mesesServicio.set(mesKey, { monto: 0, cantidad: 0 });
    }

    const datos = mesesServicio.get(mesKey)!;
    datos.monto += egreso.monto;
    datos.cantidad++;
  }

  // Construir resultado por servicio
  const serviciosResult: AnalisisPorServicioMes[] = [];

  for (const [servicioKey, mesesData] of Array.from(porServicio.entries())) {
    const servicio = servicioKey !== 'SIN_SERVICIO' ? serviciosMap.get(servicioKey) : null;
    const tipoServicio = servicio ? tiposServicioMap.get(servicio.tipo) : null;

    const meses: AnalisisPorServicioMesItem[] = mesesEnRango.map(m => {
      const key = `${m.mes}-${m.anio}`;
      const datos = mesesData.get(key) || { monto: 0, cantidad: 0 };
      return {
        mes: m.mes,
        anio: m.anio,
        mesLabel: m.label,
        monto: datos.monto,
        cantidad: datos.cantidad
      };
    });

    serviciosResult.push({
      servicioId: servicioKey === 'SIN_SERVICIO' ? '' : servicioKey,
      servicioNombre: servicio?.nombre || 'Sin servicio asignado',
      servicioColor: tipoServicio?.color || 'default',
      fechaInicio: fechaInicioStr,
      fechaFin: fechaFinStr,
      meses,
      total: meses.reduce((sum, m) => sum + m.monto, 0),
      cantidadTotal: meses.reduce((sum, m) => sum + m.cantidad, 0)
    });
  }

  // Ordenar por total descendente
  serviciosResult.sort((a, b) => b.total - a.total);

  // Calcular totales por mes
  const totalesPorMes: AnalisisPorServicioMesItem[] = mesesEnRango.map(m => {
    const totalMes = serviciosResult.reduce((sum, s) => {
      const mesDatos = s.meses.find(md => md.mes === m.mes && md.anio === m.anio);
      return sum + (mesDatos?.monto || 0);
    }, 0);
    const cantidadMes = serviciosResult.reduce((sum, s) => {
      const mesDatos = s.meses.find(md => md.mes === m.mes && md.anio === m.anio);
      return sum + (mesDatos?.cantidad || 0);
    }, 0);
    return {
      mes: m.mes,
      anio: m.anio,
      mesLabel: m.label,
      monto: totalMes,
      cantidad: cantidadMes
    };
  });

  return {
    fechaInicio: fechaInicioStr,
    fechaFin: fechaFinStr,
    clasificacion,
    servicios: serviciosResult,
    totalesPorMes,
    totalGeneral: egresosDelPeriodo.reduce((sum, e) => sum + e.monto, 0)
  };
}
