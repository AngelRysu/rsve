const db = require("../config/mysql");
const {areIntervalsOverlapping, generarCodigoAlfanumericoAleatorio, obtenerSemanaActualDomingoASabado} = require("../helpers/tiempo");
const Mailer = require("../helpers/Mail");

const registrar_reservacion = async (req, res) => {
    const {idSala, nombre, correo, area, fecha, hora_inicio, hora_fin} = req.body;
    const con = await db.getConnection();
    const fechaActual = new Date();

    console.log(fechaActual);
    const fecha_arr = fecha.split("-");
    const horas_minutos = hora_inicio.split(":");
    const fechaUsuario = new Date(fecha_arr[0], fecha_arr[1] - 1, fecha_arr[2], horas_minutos[0], horas_minutos[1], 0, 0);

    //validar que no sea sabado ni domingo
    const dia = fechaUsuario.getDay();
    if(dia === 6 || dia === 0){
        return res.status(400).json({ok: false, "msg": "fecha y hora invalida: no se puede reservar en sabado ni domingo"});
    }
    
    //validar que la fecha sea mayor a la fecha actual
    if(fechaActual >= fechaUsuario){
        return res.status(400).json({ok: false, "msg": "fecha y hora invalida: la fecha y hora es menor a la actual"}); 
    }

    //validar los 15 minutos de tolerancia 
    fechaActual.setMinutes(fechaActual.getMinutes() + 15);
    if(fechaActual >= fechaUsuario){
        return res.status(400).json({ok: false, "msg": "fecha y hora invalida: Solo hay 15 minutos de tolerancia"});
    }

    //validar que la hora de fin sea mayor a la hora de inicio
    const horas_minutos_fin = hora_fin.split(":");
    const fechaUsuario_fin = new Date(fecha_arr[0], fecha_arr[1] - 1, fecha_arr[2], horas_minutos_fin[0], horas_minutos_fin[1], 0, 0);

    if(fechaUsuario_fin <= fechaUsuario){
        return res.status(400).json({ok: false, "msg": "fecha y hora invalida: la hora de finalización no puede ser menor a la hora de inicio"});
    }


    const mailer = new Mailer();

    try{
        //validacion que no puede reservar hasta que confirme sus reservaciones anteriores
        const [validacion_reservacion] = await con.query("SELECT count(idReservacion) AS res FROM reservacion WHERE correo = ? AND status = 'reservado' AND vigencia > UNIX_TIMESTAMP()", [correo]);
        if(validacion_reservacion[0].res > 0){
            return res.status(400).json({ok: false, "msg": "Tiene reservaciones pendientes de confirmar"});
        }

        const [reservaciones_previas] = await con.query("SELECT hora_inicio, hora_fin FROM reservacion WHERE idSala = ? AND fecha = ?", [idSala, fecha]);

        for (const resv of reservaciones_previas){
            if(areIntervalsOverlapping(resv.hora_inicio, resv.hora_fin, hora_inicio, hora_fin)){
                return res.status(400).json({ok: false, "msg": "Ya está reservado en el lapso seleccionado"});
            }
        }

        const code = await generarCodigoUnico(8);
        const obj = [idSala, code, nombre, correo, area, fecha, hora_inicio, hora_fin];
        await con.query("INSERT INTO reservacion(idSala, codigo, vigencia, nombre, correo, area, fecha, hora_inicio, hora_fin) VALUES(?, ?, UNIX_TIMESTAMP() + 900, ?, ?, ?, ?, ?, ?)", obj);
        const tiempo = Math.floor(Date.now() / 1000) + 900;
        const mensaje = 
            `Hola ${nombre},

            Gracias por tu reservación.

            Tu reservación ha sido registrada exitosamente. Por favor, confirma tu reservación dentro de los próximos 15 minutos: ${new Date(tiempo * 1000).toLocaleString()}

            📅 Fecha de la reunion: ${new Date(fecha).toLocaleString()}

            ✅ Para confirmar tu reservación, ingresa el siguiente código en la aplicación:
            Código: ${code}
            
            Gracias por confiar en nosotros.`;

        await mailer.enviarCorreo(correo, 'Confirma tu reservación', mensaje);

        return res.status(200).json({ok: true, codigo: code});
    }catch(err){
        console.log(err);
        return res.status(500).json({ok: false, msg: 'Algo salió mal'});
    }finally{
        con.release();
    }
}

const generarCodigoUnico = async (longitudCodigo = 8) => {
    let codigoGenerado;
    let codigoExiste = true;

    // Bucle para generar códigos hasta encontrar uno que no exista
    while (codigoExiste) {
        codigoGenerado = generarCodigoAlfanumericoAleatorio(longitudCodigo);
        codigoExiste = await existeCodigoEnDB(codigoGenerado);
    }
    return codigoGenerado;
}

const existeCodigoEnDB = async (codigo) => {
    const con = await db.getConnection()
    try {
        const [rows] = await con.execute('SELECT count(codigo) AS cod FROM reservacion WHERE codigo = ?', [codigo]);
        return rows[0].cod > 0; // Retorna true si el código existe, false si no
    } catch (error) {
        console.log(err);
        res.status(500).json({ok: false, msg: 'Algo salió mal'});
    } finally {
        con.release();
    }
}


const obtener_reservaciones = async (req, res) => {
    const semana = obtenerSemanaActualDomingoASabado();
    const con = await db.getConnection();
    const {sala} = req.params;

    try{
        const [reservaciones] = await con.query("SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, hora_inicio, hora_fin, status from reservacion WHERE idSala = ? AND fecha BETWEEN ? AND ?", [sala, semana.inicio, semana.fin]);
        return res.status(200).json(reservaciones);
    }catch(err){
        console.log(err);
        return res.status(500).json({ok: false, msg: 'Algo salió mal'});
    }finally{
        con.release();
    }
}

const obtener_reservaciones_dia = async (req, res) => {
    const {dia, sala} = req.params;
    const con = await db.getConnection();
    try{
        const [reservaciones] = await con.query("SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, hora_inicio, hora_fin, status from reservacion WHERE idSala = ? AND fecha = ? AND status IN ('reservado','confirmado')", [sala, dia]);
        return res.status(200).json(reservaciones);
    }catch(err){
        console.log(err);
        return res.status(500).json({ok: false, msg: 'Algo salió mal'});
    }finally{
        con.release();
    }
}

const confirmar_reservacion = async (req, res) => {
    const con = await db.getConnection();
    const { code } = req.params;
    const mailer = new Mailer();

    try {
        const [reservaciones] = await con.query(
            "SELECT * FROM reservacion WHERE vigencia >= UNIX_TIMESTAMP() AND codigo = ?;",
            [code]
        );

        if (reservaciones.length === 0) {
            return res.status(400).json({ ok: false, msg: 'Código inválido o expirado' });
        }

        const reserva = reservaciones[0];

        if (reserva.status === 'confirmado') {
            return res.status(400).json({ ok: false, msg: 'Reservación ya confirmada' });
        }

        await con.query("UPDATE reservacion SET status = 'confirmado' WHERE codigo = ?", [code]);

        console.log('Reservación confirmada:', code);

        // Contenido del correo en texto plano
        const mensaje = 
            `✅ Reservación confirmada

            Hola ${reserva.nombre},

            Tu reservación ha sido confirmada exitosamente.

            📅 Fecha y hora: ${new Date(reserva.vigencia * 1000).toLocaleString()}


            Gracias por confiar en nosotros.
            `;
        await mailer.enviarCorreo(reserva.correo, 'Confirmación de reservación', mensaje);
        // Si quieres enviar HTML, tendrías que modificar tu clase para incluir `html: htmlMensaje`

        return res.status(200).json({ ok: true, msg: 'Reservación confirmada exitosamente' });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
};


const validar_reservas = async (req, res) => {
    const { correo } = req.body;
    const con = await db.getConnection();
    try
    {
        const [validacion_reservacion] = await con.query("SELECT * FROM reservacion WHERE correo = ? AND status = 'reservado' AND vigencia > UNIX_TIMESTAMP()", [correo]);
        if(validacion_reservacion.length > 0)
        {
            return res.status(200).json({ok: true, data: validacion_reservacion});
        }
    }
    catch(err)
    {
        console.log(err);
        return res.status(500).json({ok: false, msg: 'Algo salió mal'});
    }
    finally
    {
        con.release();
    }
};

const obtener_reservas = async (req, res) => {
    const { correo } = req.body;
    const con = await db.getConnection();

    try {
        const [reservas] = await con.query("SELECT s.nombre as sala, r.idSala , r.fecha, r.hora_inicio, r.hora_fin FROM reservacion r join salas as s on r.idSala = s.idSala WHERE correo = ? AND status = 'confirmado' AND fecha BETWEEN CURDATE() AND CURDATE() + INTERVAL 7 DAY", [correo])
        if (reservas.length > 0) {
            return res.status(200).json({ ok: true, data: reservas });
        } else {
            return res.status(404).json({ ok: false, msg: 'No se encontraron reservaciones para esta semana' });
        }
    } catch(err)
        {
            console.log(err);
            return res.status(500).json({ok: false, msg: 'Algo salió mal'});
        }
    finally
        {
            con.release();
        }
};



module.exports = {
    registrar_reservacion,
    obtener_reservaciones,
    confirmar_reservacion,
    obtener_reservaciones_dia,
    validar_reservas,
    obtener_reservas
}