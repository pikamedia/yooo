
exports.register = async (req, res) => {
  var token = req.headers['x-access-token'];
  console.log(`mobile register data \n${JSON.stringify(req.body, null, 2)}`);
  const _decoded = jwt.verify(token, config.secret);
  var checkRegistrasi = await RegistrasiPeserta.findOne({
    where: {
      nik: _decoded.id || _decoded.nik,
      naw: _decoded.naw
    }
  })
  const dataPeserta = await Peserta.findOne({
    where: {
      nik: _decoded.id,
      no_ahli_waris: _decoded.naw,
    }
  });
  if (checkRegistrasi == null) {
    checkRegistrasi = await RegistrasiPeserta.create({
      nik: _decoded.id || _decoded.nik,
      naw: _decoded.naw,
      nama_ahli_waris: dataPeserta.nama_ahli_waris
    });
  }
  // const registrasiPeserta = await RegistrasiPeserta.findOne({
  //   nik: req.body.nik,
  //   naw: _decoded.naw
  // })
  // const registrationAttemptCount = await RegistrasiPesertaDetail.count({
  //   where: {
  //     registrasi_id: registrasiPeserta.id
  //   }
  // })
  // if (registrationAttemptCount >= 3) {
  //   return res.status(403).send({
  //     status: false,
  //     message: "Limit registrasi tercapai. silakan hubungi admin"
  //   })
  // }

  if (req.headers['x-registration-id'] && req.headers['x-registration-id'].length > 0) {
    var checkDetail = await RegistrasiPesertaDetail.findOne({
      where: {
        id: req.headers['x-registration-id']
      }
    })
    if (checkDetail && (checkDetail.nik == (_decoded.id || _decoded.nik) && checkDetail.naw == _decoded.naw)) {
      var dataToUpdate = {}

      if (checkDetail.device_id == null || checkDetail.firebase_token == null) {
        dataToUpdate.device_id = req.body.device_id; // 
        dataToUpdate.firebase_token = req.body.firebase_token; // 
      }
      if (checkDetail.face_id == null) {
        dataToUpdate.face_id = req.file.filename;
      }
      if (checkDetail.code_status == CODE_STATUS.RETURNED) {
        dataToUpdate.face_id = req.file.filename;
      }
      RegistrasiPesertaDetail.update({
        device_id: req.body.device_id,
        firebase_token: req.body.firebase_token,
        face_id: req.file.filename
      }, {
        where: {
          id: req.headers['x-registration-id']
        },
        returning: true
      }).then(async (result) => {
        var [count, [data]] = result;
        const peserta = await RegistrasiPeserta.findOne(
          {
            where: {
              nik: _decoded.id || _decoded.nik,
              naw: _decoded.naw
            }
          })
        if (peserta.code_status == CODE_STATUS.APPROVED) {
          await RegistrasiPeserta.update({
            device_id: req.body.device_id,
            firebase_token: req.body.firebase_token
          },
            {
              where: {
                nik: _decoded.id || _decoded.nik,
                naw: _decoded.naw
              }
            })
        }
        let parsedData = JSON.stringify({
          status: true,
          message: "Face ID Has been Registered",
          nik: peserta.nik,
          naw: peserta.naw,
          foto: req.file.filename,
          registration_id: data.id,
          device_id: data.device_id,
          firebase_token: data.firebase_token
        });
        await LogHistory.create({
          id_param: 3,
          registration_id: data.id,
          nik: _decoded.nik,
          naw: _decoded.naw,
          log_detail: parsedData,
          created_by: peserta.nama_ahli_waris,
        })
        return res.status(201).send({
          data: {
            status: true,
            message: "Face ID Has been Registered",
            nik: peserta.nik,
            foto: req.file.filename,
            registration_id: data.id
          },
        });
      })
        .catch(async (err) => {
          let parsedData = JSON.stringify({ status: false, message: err.message, data: req.body });
          await LogHistory.create(
            {
              id_param: 3,
              nik: req.body.nik,
              naw: _decoded.naw,
              log_detail: parsedData,
              created_by: "System error log"
            }
          )
          console.log(err.stack);
          res.status(500).send({ status: false, message: err.message, data: req.body });
        });
    }
    else {
      RegistrasiPesertaDetail
        .create({
          registration_id: checkRegistrasi.id,
          code_status: CODE_STATUS.UNFINISHED,
          nik: _decoded.id || _decoded.nik,
          naw: _decoded.naw,
          face_id: req.file.filename,
          device_id: req.body.device_id,
          firebase_token: req.body.firebase_token
        })
        .then(async (data) => {
          const peserta = await RegistrasiPeserta.findOne(
            {
              where: {
                nik: _decoded.id || _decoded.nik,
                naw: _decoded.naw
              }
            })
          let parsedData = JSON.stringify({
            status: true,
            message: "Face ID Has been Registered",
            nik: peserta.nik,
            naw: peserta.naw,
            foto: req.file.filename,
            registration_id: data.id,
            device_id: req.body.device_id,
            firebase_token: req.body.firebase_token
          });
          await LogHistory.create({
            id_param: 3,
            registration_id: data.id,
            nik: _decoded.nik,
            naw: _decoded.naw,
            log_detail: parsedData,
            created_by: peserta.nama_ahli_waris,
          })
          return res.status(201).send({
            data: {
              status: true,
              message: "Face ID Has been Registered",
              nik: peserta.nik,
              foto: req.file.filename,
              registration_id: data.id
            },
          });
        })
        .catch(async (err) => {
          let parsedData = JSON.stringify({ status: false, message: err.message, data: req.body });
          await LogHistory.create(
            {
              id_param: 3,
              nik: req.body.nik,
              naw: _decoded.naw,
              log_detail: parsedData,
              created_by: "System error log"
            }
          )
          console.log(err.stack);
          return res.status(500).send({ status: false, message: err.message, data: req.body });
        });
    }
  }
  else {
    RegistrasiPesertaDetail
      .create({
        registration_id: checkRegistrasi.id,
        code_status: CODE_STATUS.UNFINISHED,
        nik: _decoded.id || _decoded.nik,
        naw: _decoded.naw,
        face_id: req.file.filename,
        device_id: req.body.device_id,
        firebase_token: req.body.firebase_token
      })
      .then(async (data) => {
        const peserta = await RegistrasiPeserta.findOne(
          {
            where: {
              nik: _decoded.id || _decoded.nik,
              naw: _decoded.naw
            }
          })
        let parsedData = JSON.stringify({
          status: true,
          message: "Face ID Has been Registered",
          nik: peserta.nik,
          naw: peserta.naw,
          foto: req.file.filename,
          registration_id: data.id,
          device_id: req.body.device_id,
          firebase_token: req.body.firebase_token
        });
        await LogHistory.create({
          id_param: 3,
          registration_id: data.id,
          nik: _decoded.nik,
          naw: _decoded.naw,
          log_detail: parsedData,
          created_by: peserta.nama_ahli_waris,
        })
        return res.status(201).send({
          data: {
            status: true,
            message: "Face ID Has been Registered",
            nik: peserta.nik,
            foto: req.file.filename,
            registration_id: data.id
          },
        });
      })
      .catch(async (err) => {
        let parsedData = JSON.stringify({ status: false, message: err.message, data: req.body });
        await LogHistory.create(
          {
            id_param: 3,
            nik: req.body.nik,
            naw: _decoded.naw,
            log_detail: parsedData,
            created_by: "System error log"
          }
        )
        console.log(err.stack);
        return res.status(500).send({ status: false, message: err.message, data: req.body });
      });
    }
}
