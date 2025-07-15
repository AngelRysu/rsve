const db = require("../config/mysql");
const bycrypt = require("bcryptjs");

const registrar_usuario = async (req, res) => {
    const {mail, pass, name, area } = req.body;

    password = bycrypt.hashSync(pass, 10);

    const con = await db.getConnection();
    try{
        const [Usuarios] = await con.query("SELECT * FROM usuarios Where status = 'Activo'");
        if (mail in Usuarios.map(usuario => usuario.nombre)) {
            return res.status(400).json({ok: false, msg: "el usuario ya existe"});
        }
        await con.query("INSERT INTO usuarios(mail, pass, name, area) VALUES(?, ?, ?, ?);", [mail, password, name, area]);
        return res.status(201).json({msg: "Usuario creado exitosamente"});
    }catch(err){
        console.log(err);
        res.status(500).json({ok: false, msg: 'Algo salió mal'});
    }finally{
        con.release();
    }
}

const obtener_Usuarios = async (req, res) => {
    const con = await db.getConnection();
    try {
        const [Usuarios] = await con.query("SELECT * FROM usuarios WHERE status = 'Activo'");

        const final_Json = Usuarios.map(usuario => ({
            idUser: usuario.idUser,
            mail: usuario.mail,
            name: usuario.name,
            area: usuario.area,
            status: usuario.status
        }));

        return res.status(200).json(final_Json);
    } catch (err) {
        console.log(err);
        res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
};


const obtener_Usuario_One = async (req, res) => {
    const { idUser } = req.params;
    const con = await db.getConnection();
    try {
        const [Usuarios] = await con.query("SELECT * FROM usuarios WHERE idUser = ? AND status = 'Activo'", [idUser]);
        if (Usuarios.length === 0) {
            return res.status(404).json({ ok: false, msg: "Sala no encontrada" });
        }

        const usuario = Usuarios[0];

        const result = {
            idUser: usuario.idUser,
            mail: usuario.mail,
            name: usuario.name,
            area: usuario.area,
            status: usuario.status
        };

        return res.status(200).json(result);
    } catch (err) {
        console.log(err);
        res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

const modificar_Usuario = async (req, res) => {
    const { idUser } = req.params;
    const { mail, pass, name, area } = req.body;
    const con = await db.getConnection();

    try {
        const [Usuarios] = await con.query("SELECT * FROM usuarios WHERE iduser = ? AND status = 'Activo' AND type != 'admin'", [idUser]);
        if (Usuarios.length === 0) {
            return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
        }

        if (!pass ) {
            password = Usuarios[0].pass;
        }
        else {
            password = bycrypt.hashSync(pass, 10);
        }
        await con.query(
            "UPDATE usuarios SET mail = ?, pass = ?, name = ?, area = ? where iduser = ?",
            [mail, password, name, area, idUser]
        );

        const [updatedUsuarioRows] = await con.query("SELECT * FROM usuarios WHERE iduser = ? AND type != 'admin'", [idUser]);
        const usuario = updatedUsuarioRows[0];

        const result = {
            idUser: usuario.idUser,
            mail: usuario.mail,
            name: usuario.name,
            area: usuario.area,
            status: usuario.status
        };

        return res.status(200).json(result);
    } catch (err) {
        console.log(err);
        res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

const eliminar_Usuario = async (req, res) => {
    const { idUser } = req.params;
    const con = await db.getConnection();
    try {
        const [Usuarios] = await con.query("SELECT * FROM usuarios WHERE idUser = ? AND status = 'Activo' and type != 'admin'", [idUser]);
        if (Usuarios.length === 0) {
            return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
        }

        await con.query("UPDATE usuarios SET status = 'Inactivo' WHERE idUser = ?", [idUser]);

        return res.status(200).json({ ok: true, msg: "Usuario eliminado correctamente" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

module.exports = {
    registrar_usuario,
    obtener_Usuarios,
    obtener_Usuario_One,
    modificar_Usuario,
    eliminar_Usuario
}