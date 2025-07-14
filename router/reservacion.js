const { Router } = require("express");
const {registrar_reservacion, obtener_reservaciones, confirmar_reservacion, obtener_reservaciones_dia, validar_reservas } = require("../controllers/reservacion")

const routerReservacion = Router();

routerReservacion.post('/', registrar_reservacion);
routerReservacion.get('/:sala', obtener_reservaciones);
routerReservacion.get('/dia/:dia/:sala', obtener_reservaciones_dia);
routerReservacion.get('/confirmar/:code', confirmar_reservacion);
routerReservacion.post('/validation/', validar_reservas);

module.exports = routerReservacion;