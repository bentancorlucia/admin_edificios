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

-- Tabla CuentaBancaria
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

-- Tabla Servicio (debe ir antes de MovimientoBancario por la FK)
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_inquilino_apartamento ON Inquilino(apartamentoId);
CREATE INDEX IF NOT EXISTS idx_transaccion_apartamento ON Transaccion(apartamentoId);
CREATE INDEX IF NOT EXISTS idx_movimiento_cuenta ON MovimientoBancario(cuentaBancariaId);
CREATE INDEX IF NOT EXISTS idx_movimiento_transaccion ON MovimientoBancario(transaccionId);
CREATE INDEX IF NOT EXISTS idx_movimiento_servicio ON MovimientoBancario(servicioId);
CREATE INDEX IF NOT EXISTS idx_aviso_mes_anio ON AvisoInforme(mes, anio);
