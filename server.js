var express = require('express');
var app = express();
const fileUpload = require('express-fileupload');

const cors = require('cors');
const sharp = require('sharp');
const resizeImage = require('./resizer');
const fs = require('fs');

const UPLOADS_FOLDER = __dirname + '/uploads';
const PREVIEWS_FOLDER = __dirname + '/previews';

if (!fs.existsSync(UPLOADS_FOLDER)){
	fs.mkdirSync(UPLOADS_FOLDER)
}

if (!fs.existsSync(PREVIEWS_FOLDER)){
	fs.mkdirSync(PREVIEWS_FOLDER)
}

app.use(cors());

app.use(fileUpload({
    createParentPath: true
}));

app.use(express.static('dist'))

app.post('/upload', async (req, res) => {
    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            const { image: upload } = req.files;
			const { name } = upload;
			await upload.mv(`${UPLOADS_FOLDER}/${name}`);

			const image = await sharp(`${UPLOADS_FOLDER}/${name}`);
			const { width, height} = await image.metadata();
			const size = Math.min(width, height);

			await image.resize(size, size, {
				fit: 'cover'
			})

			const buffer = await image.toBuffer();
			await sharp(buffer).toFile(`${UPLOADS_FOLDER}/${name}`)

			await image.resize(1024, 1024, {
				fit: 'cover',
				withoutEnlargement: true
			})

			await image.toFile(`${PREVIEWS_FOLDER}/${name}`)
			res.status(200).send();
        }
    } catch (err) {
		console.log(err)
        res.status(500).send(err);
    }
});

const generateAnimation = async (res, folder, filename, shapes) => {
	const input = sharp(`${folder}/${filename}`);
		const image = shapes.length > 0 ? await resizeImage(input, shapes) : input;
		res.status(200);
		res.contentType('image/jpeg');
		return res.send(await image.toBuffer());
}

const generateStatic = async (res, folder, filename, shapes) => {
	const input = sharp(`${folder}/${filename}`);
	const image = shapes.length > 0 ? await resizeImage(input, shapes) : input;
	res.status(200);
	res.contentType('image/jpeg');
	return res.send(await image.toBuffer());
}

const generateImage = async (isPreview, req, res, next) => {
	const folder = isPreview ? PREVIEWS_FOLDER : UPLOADS_FOLDER;
	const shapes = req.query?.shapes ? JSON.parse(req.query?.shapes) : [];
	const isAnimation = req.query?.isAnimation ?? false;
	
	try {
		if (isAnimation) {
			generateAnimation(res, folder, req.params.filename, shapes);
			return;
		}

		generateStatic(res, folder, req.params.filename, shapes);
	} catch (error) {
		next(error)
	}
};

app.use('/preview/:filename', async (req, res, next) => generateImage(true, req, res, next));
app.use('/final/:filename', async (req, res, next) => generateImage(false, req, res, next));

app.use('/original/:filename', async (req, res) => {
	const image = sharp(`${UPLOADS_FOLDER}/${req.params.filename}`);
	res.status(200);
	res.contentType('image/jpeg');
	return res.send(await image.toBuffer());
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log('Server launched on port', port));
