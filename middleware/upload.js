const multer = require('multer');
const path = require('path');

// =====================================
// STORAGE
// =====================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, 'uploads/');

    },

    filename: (req, file, cb) => {

        const uniqueName =
            Date.now() +
            '-' +
            Math.round(Math.random() * 1E9);

        cb(
            null,
            uniqueName +
            path.extname(file.originalname)
        );

    },

});

// =====================================
// FILE FILTER
// =====================================

const fileFilter = (req, file, cb) => {

    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/pdf',
    ];

    if (
        allowedTypes.includes(file.mimetype)
    ) {

        cb(null, true);

    } else {

        cb(
            new Error(
                'Only JPG, PNG, PDF allowed'
            ),
            false
        );

    }

};

// =====================================
// UPLOAD
// =====================================

const upload = multer({

    storage,

    fileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024,
    },

});

module.exports = upload;