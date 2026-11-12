
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is missing from your .env file');
}

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function isValidUniversityEmail(email) {
    return /^[^\s@]+@[a-z0-9-]+\.saiuniversity\.edu\.in$/i.test(email);
}

function sanitizeItemInput(body) {
    return {
        title: normalizeText(body.title),
        category: normalizeText(body.category),
        description: normalizeText(body.description),
        location: normalizeText(body.location),
        listingType: normalizeText(body.listingType),
        date: body.date ? new Date(body.date) : new Date(),
        imageUrl: normalizeText(body.imageUrl) || ''
    };
}

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// --------------------------------------------------
// DATABASE MODELS
// --------------------------------------------------

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    }
}, { timestamps: true });

const itemSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    category: String,
    description: String,
    location: String,
    listingType: String,
    date: {
        type: Date,
        default: Date.now
    },
    imageUrl: String,
    status: {
        type: String,
        default: 'Open'
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

const claimSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    proofDescription: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    dateSubmitted: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);
const Claim = mongoose.model('Claim', claimSchema);

// --------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// --------------------------------------------------

async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(401).json({
                message: 'User account not found.'
            });
        }

        req.user = user;
        next();

    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired login session. Please log in again.'
        });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Admin access required.'
        });
    }

    next();
}

// --------------------------------------------------
// AUTHENTICATION ROUTES
// --------------------------------------------------

// REGISTER
app.post('/api/auth/register', async (req, res) => {
    try {
        const name = normalizeText(req.body.name);
        const email = normalizeText(req.body.email)?.toLowerCase();
        const password = req.body.password;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: 'Please fill in all required fields.'
            });
        }

        if (!isValidUniversityEmail(email)) {
            return res.status(400).json({
                message: 'Please use your Sai University email address.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: 'Password must contain at least 6 characters.'
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                message: 'An account with this email already exists.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'user'
        });

        res.status(201).json({
            message: 'Registration successful!',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Registration error:', error);

        res.status(500).json({
            message: 'Registration failed. Please try again.'
        });
    }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    try {
        const email = normalizeText(req.body.email)?.toLowerCase();
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Please enter your email and password.'
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        let passwordMatches = false;

        try {
            passwordMatches = await bcrypt.compare(
                password,
                user.password
            );
        } catch (error) {
            passwordMatches = false;
        }

        // Upgrade older plain-text passwords after successful login.
        if (!passwordMatches && user.password === password) {
            user.password = await bcrypt.hash(password, 12);
            await user.save();
            passwordMatches = true;
        }

        if (!passwordMatches) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const token = jwt.sign(
            { userId: user._id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);

        res.status(500).json({
            message: 'Login failed. Please try again.'
        });
    }
});

// --------------------------------------------------
// ITEM ROUTES
// --------------------------------------------------

// GET ALL ITEMS - PUBLIC
app.get('/api/items', async (req, res) => {
    try {
        const filter = {};

        if (req.query.search) {
            const search = normalizeText(req.query.search);

            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        if (req.query.category) {
            filter.category = req.query.category;
        }

        if (req.query.listingType) {
            filter.listingType = req.query.listingType;
        }

        const items = await Item.find(filter)
            .populate('postedBy', 'name email')
            .sort({ date: -1 });

        res.json(items);

    } catch (error) {
        console.error('Get items error:', error);

        res.status(500).json({
            message: 'Unable to load items.'
        });
    }
});

// GET ITEMS REPORTED BY LOGGED-IN USER
app.get('/api/items/mine', authenticateToken, async (req, res) => {
    try {
        const items = await Item.find({
            postedBy: req.user._id
        })
            .populate('postedBy', 'name email')
            .sort({ date: -1 });

        res.json(items);

    } catch (error) {
        console.error('My items error:', error);

        res.status(500).json({
            message: 'Unable to load your reported items.'
        });
    }
});

// REPORT A NEW ITEM
app.post('/api/items', authenticateToken, async (req, res) => {
    try {
        const itemData = sanitizeItemInput(req.body);

        if (
            !itemData.title ||
            !itemData.category ||
            !itemData.description ||
            !itemData.location ||
            !itemData.listingType
        ) {
            return res.status(400).json({
                message: 'Please fill in all required item details.'
            });
        }

        if (
            itemData.date &&
            Number.isNaN(itemData.date.getTime())
        ) {
            return res.status(400).json({
                message: 'Please provide a valid item date.'
            });
        }

        const item = await Item.create({
            ...itemData,
            postedBy: req.user._id,
            status: 'Open'
        });

        res.status(201).json({
            message: 'Item reported successfully!',
            item
        });

    } catch (error) {
        console.error('Report item error:', error);

        res.status(500).json({
            message: 'Unable to report item.'
        });
    }
});

// --------------------------------------------------
// CLAIM / RECOVERY REQUEST ROUTES
// --------------------------------------------------

// SUBMIT A RECOVERY REQUEST
app.post('/api/claims', authenticateToken, async (req, res) => {
    try {
        const { itemId, proofDescription } = req.body;

        if (!itemId || !proofDescription?.trim()) {
            return res.status(400).json({
                message: 'Item and proof description are required.'
            });
        }

        if (!isValidObjectId(itemId)) {
            return res.status(400).json({
                message: 'Invalid item ID.'
            });
        }

        const item = await Item.findById(itemId);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found.'
            });
        }

        if (item.status !== 'Open') {
            return res.status(400).json({
                message: 'This item is no longer available for recovery requests.'
            });
        }

        if (item.postedBy.toString() === req.user._id.toString()) {
            return res.status(400).json({
                message: 'You cannot submit a recovery request for your own item.'
            });
        }

        const existingClaim = await Claim.findOne({
            itemId,
            userId: req.user._id,
            status: 'Pending'
        });

        if (existingClaim) {
            return res.status(409).json({
                message: 'You already have a pending request for this item.'
            });
        }

        const claim = await Claim.create({
            itemId,
            userId: req.user._id,
            proofDescription: proofDescription.trim(),
            status: 'Pending'
        });

        res.status(201).json({
            message: 'Recovery request submitted successfully!',
            claim
        });

    } catch (error) {
        console.error('Submit claim error:', error);

        res.status(500).json({
            message: 'Unable to submit recovery request.'
        });
    }
});

// GET RECOVERY REQUESTS
// Students see their own requests. Admins see all requests.
app.get('/api/claims', authenticateToken, async (req, res) => {
    try {
        const filter = {};

        if (req.user.role !== 'admin') {
            filter.userId = req.user._id;
        }

        const claims = await Claim.find(filter)
            .populate('itemId')
            .populate('userId', 'name email')
            .sort({ dateSubmitted: -1 });

        res.json(claims);

    } catch (error) {
        console.error('Get claims error:', error);

        res.status(500).json({
            message: 'Unable to load recovery requests.'
        });
    }
});

// APPROVE OR REJECT A REQUEST - ADMIN ONLY
app.patch(
    '/api/claims/:id',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { status } = req.body;

            if (!['Approved', 'Rejected'].includes(status)) {
                return res.status(400).json({
                    message: 'Status must be Approved or Rejected.'
                });
            }

            if (!isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    message: 'Invalid recovery request ID.'
                });
            }

            const claim = await Claim.findById(req.params.id);

            if (!claim) {
                return res.status(404).json({
                    message: 'Recovery request not found.'
                });
            }

            if (claim.status !== 'Pending') {
                return res.status(400).json({
                    message: 'This request has already been processed.'
                });
            }

            if (status === 'Approved') {
                const item = await Item.findById(claim.itemId);

                if (!item) {
                    return res.status(404).json({
                        message: 'The reported item could not be found.'
                    });
                }

                if (item.status !== 'Open') {
                    return res.status(409).json({
                        message: 'This item is no longer available.'
                    });
                }

                item.status = 'Claimed';
                await item.save();
            }

            claim.status = status;
            await claim.save();

            res.json({
                message: `Recovery request ${status.toLowerCase()} successfully.`,
                claim
            });

        } catch (error) {
            console.error('Update claim error:', error);

            res.status(500).json({
                message: 'Unable to update recovery request.'
            });
        }
    }
);

// --------------------------------------------------
// ADMIN ROUTES
// --------------------------------------------------

// GET ADMIN DASHBOARD STATISTICS
app.get(
    '/api/admin/stats',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const [
                totalUsers,
                totalItems,
                lostCount,
                foundCount,
                openItems,
                claimedItems,
                totalClaims,
                pendingClaims,
                approvedClaims
            ] = await Promise.all([
                User.countDocuments({}),
                Item.countDocuments({}),
                Item.countDocuments({ listingType: 'Lost' }),
                Item.countDocuments({ listingType: 'Found' }),
                Item.countDocuments({ status: 'Open' }),
                Item.countDocuments({ status: 'Claimed' }),
                Claim.countDocuments({}),
                Claim.countDocuments({ status: 'Pending' }),
                Claim.countDocuments({ status: 'Approved' })
            ]);

            res.json({
                totalUsers,
                totalItems,
                lostCount,
                foundCount,
                openItems,
                claimedItems,
                totalClaims,
                pendingClaims,
                approvedClaims
            });

        } catch (error) {
            console.error('Admin statistics error:', error);

            res.status(500).json({
                error: 'Unable to load admin statistics.'
            });
        }
    }
);

// --------------------------------------------------
// ADMIN ITEM MANAGEMENT
// --------------------------------------------------

// GET ALL ITEMS - ADMIN ONLY
app.get(
    '/api/admin/items',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const items = await Item.find()
                .populate('postedBy', 'name email')
                .sort({ date: -1 });

            res.json(items);

        } catch (error) {
            console.error('Admin items error:', error);

            res.status(500).json({
                message: 'Unable to load campus item listings.'
            });
        }
    }
);

// UPDATE ITEM STATUS - ADMIN ONLY
app.patch(
    '/api/admin/items/:id',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { status } = req.body;

            if (!isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    message: 'Invalid item ID.'
                });
            }

            if (!['Open', 'Claimed', 'Resolved'].includes(status)) {
                return res.status(400).json({
                    message: 'Invalid item status.'
                });
            }

            const item = await Item.findById(req.params.id);

            if (!item) {
                return res.status(404).json({
                    message: 'Item not found.'
                });
            }

            item.status = status;
            await item.save();

            res.json({
                message: 'Item status updated successfully.',
                item
            });

        } catch (error) {
            console.error('Update item status error:', error);

            res.status(500).json({
                message: 'Unable to update item status.'
            });
        }
    }
);

// --------------------------------------------------
// START SERVER AFTER DATABASE CONNECTION
// --------------------------------------------------

async function startServer() {
    try {
        await mongoose.connect(
            process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lost2found'
        );

        console.log('MongoDB connected successfully!');

        app.listen(PORT, () => {
            console.log(`Lost2Found server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exit(1);
    }
}

startServer();
