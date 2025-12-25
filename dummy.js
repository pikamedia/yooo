api.post("/match", [authJwt.verifyToken, multerUtils.auth.single("foto")], async function (req, res) {
  const formData = new FormData();
  var token = req.headers['x-access-token'];
  var _decoded = jwt.verify(token, config.secret);
  if (req.file == undefined || req.body.foto_pembanding == undefined) {
    res.status(400).send({
      "message": "photo's requirements are not satisfied. make sure you send both of saved photo and captured photo"
    })
    return;
  }

  if(req.body.foto_pembanding.search('https://') < 0)
  req.body.foto_pembanding = `${config.image_base_url}${req.body.foto_pembanding}`

  const authConfig = await AuthSetting.findOne({
    raw: true
  });
  console.log(authConfig)
  const dataPeserta = await Peserta.findOne({
    where: {
      nik: _decoded.id,
      no_ahli_waris: _decoded.naw,
    }
  })

  await downloadFile(req.body.foto_pembanding, "known_photo.jpg")

  console.log("Foto pembanding downloaded")
  formData.append('tolerance', authConfig.confidence || 0.5);
  formData.append('threshold', authConfig.threshold || 0.7);
  formData.append('sharpness', authConfig.sharpness || 0.01);

  var unknownPhoto = fs.readFileSync(req.file.path);
  var knownPhoto = fs.readFileSync("known_photo.jpg");

  formData.append("known", unknownPhoto, "unknown_photo.jpg");
  formData.append("unknown", knownPhoto, "known_photo.jpg");


  const antiSpoofFormData = new FormData()
  antiSpoofFormData.append("image", `${config.image_base_url}${req.file.filename}`);

  console.log("Checking anti spoof...")

  axios.post(`${host}/api/upload`, formData, {
    headers: {
      'content-type': `multipart/form-data; boundary=${formData._boundary}`,
    }
  }).then(async (response) => {
    console.log(`filename : ${req.file.filename}`);
    console.log(`${config.image_base_url}${req.file.filename}`)
    let parsedData = JSON.stringify({
      distance: response.data.confidence,
      threshold: authConfig.threshold || 0.7,
      match: response.data.is_match,
      face_url: `${config.image_base_url}${req.file.filename}`,
      face_id: `${dataPeserta.face_id}`
    });
    await LogHistory.create({
      id_param: 4,
      nik: req.headers['nik'],
      naw: _decoded.naw,
      log_detail: parsedData,
      created_by: "System"
    })
    await login_history.create({
      nik: _decoded.id || _decoded.nik,
      naw: _decoded.naw,
      threshold: authConfig.threshold || 0.7,
      face_url: `${config.image_base_url}${req.file.filename}`,
      face_id: `${dataPeserta.face_id}`,
      distance: response.data.confidence,
      status: response.data.is_match,
      date: new Date()
    })

    if(response.data.is_match)
    {
      await RegistrasiPeserta.update({
        firebase_token: req.body.firebase_token
      }, {
        where: {
          nik: _decoded.id || _decoded.nik,
          naw: _decoded.naw,
        }
      })
      if(response.data.is_match == true)
      {
        await RegistrasiPeserta.update({
          device_id: req.headers['x-device-id']
        }, {
          where: {
            nik: _decoded.id || _decoded.nik,
            naw: _decoded.naw,
          }
        }) 
        await controller.logoutDevice(token, _decoded);
      }
    }

    res.status(200).send({
      distance: response.data.confidence,
      threshold: req.body.threshold || 0.7,
      match: response.data.is_match
    });
    
  })
    .catch(async function (err) {
      let parsedData = JSON.stringify({
        message: String(err)
      });
      await LogHistory.create({
        id_param: 4,
        nik: req.headers['nik'],
        naw: _decoded.naw,
        log_detail: parsedData,
        created_by: "System"
      })
      console.log({
        message: err.message
      })
      res.status(500).send({
        message: err.message
      });
    });

});
