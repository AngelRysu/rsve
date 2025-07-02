const parseTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Convertimos a minutos desde la medianoche para una comparación fácil
    return hours * 60 + minutes;
}

const generarCodigoAlfanumericoAleatorio = (longitud) => {
  return Math.random().toString(36).slice(2, 2 + longitud);
}


const areIntervalsOverlapping = (interval1Start, interval1End, interval2Start, interval2End) => {
    const start1 = parseTime(interval1Start);
    const end1 = parseTime(interval1End);
    const start2 = parseTime(interval2Start);
    const end2 = parseTime(interval2End);

    // Condición para que NO se crucen:
    // Intervalo 1 termina antes que Intervalo 2 empiece O
    // Intervalo 2 termina antes que Intervalo 1 empiece
    if (end1 <= start2 || end2 <= start1) {
        return false; // No hay cruce
    } else {
        return true; // Hay cruce
    }
}

const obtenerSemanaActualDomingoASabado = () =>  {
    const hoy = new Date(); // Obtenemos la fecha actual
    const diaDeLaSemana = hoy.getDay(); // 0 (Domingo) a 6 (Sábado)

    // Calculamos el inicio de la semana (Domingo)
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - diaDeLaSemana);
    inicioSemana.setHours(0, 0, 0, 0); // Establecemos la hora al inicio del día (00:00:00.000)

    // Calculamos el fin de la semana (Sábado)
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6); // 6 días después del domingo
    finSemana.setHours(23, 59, 59, 999); // Establecemos la hora al final del día (23:59:59.999)

    return {
        inicio: inicioSemana,
        fin: finSemana
    };
}



module.exports = {areIntervalsOverlapping, generarCodigoAlfanumericoAleatorio, obtenerSemanaActualDomingoASabado};