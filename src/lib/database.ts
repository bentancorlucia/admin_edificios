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

-- Tabla Servicio (debe ir antes de MovimientoBancario)
CREATE TABLE IF NOT EXISTS Servicio (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('ELECTRICISTA', 'PLOMERO', 'SANITARIO', 'CERRAJERO', 'PINTOR', 'CARPINTERO', 'ALBANIL', 'JARDINERO', 'LIMPIEZA', 'SEGURIDAD', 'FUMIGACION', 'ASCENSOR', 'VIDRIERIA', 'HERRERIA', 'AIRE_ACONDICIONADO', 'GAS', 'UTE', 'OSE', 'TARIFA_SANEAMIENTO', 'OTRO')),
    nombre TEXT NOT NULL,
    celular TEXT,
    email TEXT,
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
    clasificacionPago TEXT CHECK (clasificacionPago IN ('GASTO_COMUN', 'FONDO_RESERVA')),
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
  const statements = INIT_SQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    await database.execute(statement);
  }

  // Crear índices
  for (const indexSql of INDEX_SQL) {
    await database.execute(indexSql);
  }

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
}

export async function getTransacciones(): Promise<Transaccion[]> {
  const database = await getDatabase();
  return database.select<Transaccion[]>('SELECT * FROM Transaccion ORDER BY fecha DESC');
}

export async function getTransaccionesConApartamento(): Promise<TransaccionConApartamento[]> {
  const database = await getDatabase();
  // Ejecutar queries en paralelo
  const [transacciones, apartamentos] = await Promise.all([
    database.select<Transaccion[]>('SELECT * FROM Transaccion ORDER BY fecha DESC'),
    database.select<Apartamento[]>('SELECT * FROM Apartamento')
  ]);
  const apartamentosMap = new Map(apartamentos.map(a => [a.id, a]));

  return transacciones.map(t => ({
    ...t,
    apartamento: t.apartamentoId ? apartamentosMap.get(t.apartamentoId) || null : null
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
  // Primero eliminar movimientos bancarios relacionados
  await database.execute('DELETE FROM MovimientoBancario WHERE transaccionId = ?', [id]);
  await database.execute('DELETE FROM Transaccion WHERE id = ?', [id]);
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

export async function conciliarMovimiento(id: string, conciliado: boolean): Promise<MovimientoBancario> {
  return updateMovimientoBancario(id, { conciliado });
}

// ============ SERVICIOS ============

export interface Servicio {
  id: string;
  tipo: string;
  nombre: string;
  celular: string | null;
  email: string | null;
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
    `INSERT INTO Servicio (id, tipo, nombre, celular, email, observaciones, activo, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.tipo, data.nombre, data.celular, data.email, data.observaciones, 1, now, now]
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
  await database.execute('DELETE FROM AvisoInforme WHERE id = ?', [id]);
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

// Crear recibo de pago con lógica de negocio
export async function createReciboPago(data: {
  monto: number;
  apartamentoId: string;
  fecha: string;
  metodoPago: string;
  cuentaBancariaId: string | null;
  referencia: string | null;
  notas: string | null;
  clasificacionPago: 'GASTO_COMUN' | 'FONDO_RESERVA';
}): Promise<Transaccion> {
  const apartamento = await getApartamentoById(data.apartamentoId);
  if (!apartamento) {
    throw new Error("Apartamento no encontrado");
  }

  const tipoLabel = apartamento.tipoOcupacion === 'PROPIETARIO' ? 'Propietario' : 'Inquilino';
  const clasificacionLabels = {
    GASTO_COMUN: 'Gasto Común',
    FONDO_RESERVA: 'Fondo de Reserva',
  };
  const clasificacionLabel = clasificacionLabels[data.clasificacionPago];
  const descripcionRecibo = `Recibo de Pago (${clasificacionLabel}) - Apto ${apartamento.numero} (${tipoLabel})${data.referencia ? ` - Ref: ${data.referencia}` : ''}`;

  const recibo = await createTransaccion({
    tipo: 'RECIBO_PAGO',
    monto: data.monto,
    apartamentoId: data.apartamentoId,
    fecha: data.fecha,
    metodoPago: data.metodoPago,
    referencia: data.referencia,
    notas: data.notas,
    descripcion: descripcionRecibo,
    clasificacionPago: data.clasificacionPago,
    montoGastoComun: data.clasificacionPago === 'GASTO_COMUN' ? data.monto : null,
    montoFondoReserva: data.clasificacionPago === 'FONDO_RESERVA' ? data.monto : null,
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
      clasificacion: null,
      conciliado: false,
      servicioId: null,
    });
  }

  // Actualizar créditos pendientes
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

  return recibo;
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

  const movimiento = await createMovimientoBancario({
    tipo: 'INGRESO',
    monto: transaccion.monto,
    fecha: transaccion.fecha,
    descripcion: `Pago Apto ${apartamento?.numero || 'N/A'} - ${transaccion.descripcion || 'Recibo de pago'}`,
    referencia: transaccion.referencia,
    cuentaBancariaId,
    transaccionId,
    numeroDocumento: null,
    archivoUrl: null,
    clasificacion: null,
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
  descripcion: string;
  clasificacion: string;
  monto: number;
  banco: string;
}

export interface InformeData {
  fecha: string;
  apartamentos: InformeApartamentoData[];
  resumenBancario: ResumenBancario;
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
        descripcion: mov.descripcion || 'Sin descripción',
        clasificacion: mov.clasificacion || 'SIN_CLASIFICAR',
        monto: mov.monto,
        banco: mov.cuentaBancaria?.banco || 'N/A',
      });
    }
  }

  // Calcular saldo bancario total
  let saldoBancarioTotal = 0;
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
    detalleEgresos,
    totales,
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

  return {
    fechaInicio: fechaInicio.toISOString(),
    fechaFin: fechaFin.toISOString(),
    recibos: {
      gastosComunes: recibosGastosComunes,
      fondoReserva: recibosFondoReserva,
      total: totalRecibos,
    },
    egresos: {
      gastosComunes: egresosGastosComunes,
      fondoReserva: egresosFondoReserva,
      total: totalEgresos,
    },
    balance: {
      gastosComunes: recibosGastosComunes - egresosGastosComunes,
      fondoReserva: recibosFondoReserva - egresosFondoReserva,
      total: totalRecibos - totalEgresos,
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
  ingresos: number;
  egresos: number;
  balance: number;
  creditosPendientes: number;
  transaccionesRecientes: TransaccionConApartamento[];
  apartamentos: Apartamento[];
}

export async function getDashboardData(): Promise<DashboardData> {
  // Ejecutar todas las queries en paralelo
  const [apartamentos, todasTransacciones, transaccionesRecientes] = await Promise.all([
    getApartamentosOrdenados(),
    getTransacciones(),
    getTransaccionesRecientes(10)
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

  // Calcular gastos totales por tipo
  const gastosPropietarios = propietariosData.reduce((acc, a) =>
    acc + a.gastosComunes + a.fondoReserva, 0);
  const gastosInquilinos = inquilinosData.reduce((acc, a) =>
    acc + a.gastosComunes + a.fondoReserva, 0);

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
    ingresos,
    egresos,
    balance,
    creditosPendientes,
    transaccionesRecientes,
    apartamentos,
  };
}
