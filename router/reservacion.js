const { Router } = require("express");
const {registrar_reservacion, obtener_reservaciones, confirmar_reservacion } = require("../controllers/reservacion")

const routerReservacion = Router();

routerReservacion.post('/', registrar_reservacion);
routerReservacion.get('/:sala', obtener_reservaciones);
routerReservacion.get('/confirmar/:code', confirmar_reservacion);

module.exports = routerReservacion;