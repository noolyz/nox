const STEAL_CONFIG = {
    cooldown: 1 * 60 * 60 * 1000, // 1 hour in milliseconds
    protection: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
    min_wallet: 250, // minimum coins in wallet to be a valid target
    plans: {
        stealth: {
            name: 'Stealth',
            description: 'Low risk, low reward.',
            successChance: 0.75, // 75% success
            caughtChance: 0.25, // 30% chance of being caught if failed
            stealPercent: 0.10, // Steals 10%
            penaltyPercent: 0.10, // Loses 10% if caught
        },
        balanced: {
            name: 'Balanced',
            description: 'Moderate risk, moderate reward.',
            successChance: 0.40,
            caughtChance: 0.60,
            stealPercent: 0.25,
            penaltyPercent: 0.20,
        },
        aggressive: {
            name: 'Aggressive',
            description: 'High risk, high reward.',
            successChance: 0.15,
            caughtChance: 0.85,
            stealPercent: 0.65,
            penaltyPercent: 0.30,
        }
    }
};

const ENCOUNTERS = [
    {
        name: 'Gang members',
        message: 'You encounter a group of gang members blocking your path. They demand your valuables, they threaten you with violence if you don\'t comply.',
        requiredPower: 8,
        penaltyPercent: 0.20,
    },
    {
        name: 'Cartel',
        message: 'The cartel has found you, they think you\'re someone important. They demand to know what you\'re doing in their territory.',
        requiredPower: 28,
        penaltyPercent: 0.30,
    },
    {
        name: 'Corrupt Police',
        message: 'Some corrupt police officers have taken an interest in you, so they approach you with other intentions, trying to extort you threatening you with arrest if you don\'t comply.',
        requiredPower: 70,
        penaltyPercent: 0.45,
    },
];

const ITEM_PRICES = {
    //common
    'Paper': 5, 'Old newspaper': 8, 'Wool': 10, 'Metal piece': 10, 'Rotten wood': 9, 'Plastic': 4, 'Razor blade': 6, 'Half-used Spray can': 5, 'Stick': 8,
    //rare
    'Wood': 15, 'Smooth stone': 14, 'String': 20, 'Low-quality gunpowder': 30, 'Magnifying glass': 25, 'Adhesive tape': 18, 'Bullets 9 mm': 20, 'Metal parts': 25,
    //epic
    'Steel plate': 180, 'Worn axe head': 200, 'Refined gunpowder': 250, 'Basic weapon sight': 190, 'Leather': 130, 'Bullets 223 Remington': 180,
    //mythical
    'Carbon fiber': 700, 'Advanced weapon sight': 1000, 'Bullets 308 Winchester': 850, 'Sword handle': 1200, 'Sharp rock': 1300, 'Advanced thread': 1000, 'Old zippo': 3500, 'Strong leather': 2800,
    //legendary
    'Kami': 9000, 'Tsuka': 1400, 'Military weapon magazine': 23000, 'Strong wood': 15000, 'Rolled steel': 20000, 'Bullets 7-62x39 mm': 70000, 'Crafting book': 30000, 'Tesseract': 100000, 'Golden ant': 90000,
    //Secret
    'Dryne Secret files': 1000000, 'Casino vault': 500000, 'Cartel money': 835923, 'Pandora box': 3000000
};

const STOCK_RANGES = {
    common: { min: 7, max: 10 },
    rare: { min: 3, max: 6 },
    epic: { min: 4, max: 6 },
    mythical: { min: 2, max: 3 },
    legendary: { min: 1, max: 1 },
};

const SHOP_DEAL_OF_THE_DAY_DISCOUNT = 0.3;

const SHOP_RARITY_WEIGHTS = {
    common: 45,    // 45% de probabilidad de que un slot sea para un objeto común
    rare: 30,      // 30% de probabilidad
    epic: 17,      // 17% de probabilidad
    mythical: 8,   // 8% de probabilidad
    legendary: 6,  // 6% de probabilidad (muy raro)
};

const WEAPON_PRICES = {
    'Baseball bat': 20,
    'Cutting paper knife': 35,
    'Camping axe': 150,
    'Sword': 200,
    'Katana': 25000,
    'Toy gun': 120,
    'Pistol': 1800,
    'Rifle': 3000,
    'Sniping rifle': 5000,
    'AK-47': 55000,
};

const WEAPON_STATS = {
    // Meele
    'Baseball bat':    { damage: [15, 22], accuracy: 0.90 },
    'Cutting paper knife':    { damage: [20, 28], accuracy: 0.88 },
    'Camping axe':            { damage: [30, 40], accuracy: 0.75 },
    'Sword':                  { damage: [50, 65], accuracy: 0.80 },
    'Katana':                 { damage: [70, 85], accuracy: 0.88 },
    // Guns
    'Toy gun':                { damage: [5, 10],  accuracy: 0.95 },
    'Pistol':                 { damage: [25, 35], accuracy: 0.85 },
    'Rifle':                  { damage: [40, 55], accuracy: 0.78 },
    'Sniping rifle':          { damage: [60, 75], accuracy: 0.70 },
    'AK-47':                  { damage: [50, 80], accuracy: 0.72 },
};

const BACKPACK_UPGRADES = [
    { tier: 0, name: 'Broken backpack', capacity: 12, emoji: '🪵' },
    { tier: 1, name: 'Duffel bag', capacity: 20, materials: { 'Wool': 5, 'Adhesive tape': 2 } },
    { tier: 2, name: 'Leather Backpack', capacity: 30, materials: { 'Leather': 5, 'Stick': 4, 'Adhesive tape': 3 } },
    { tier: 3, name: 'Advanced Backpack', capacity: 40, materials: { 'Carbon fiber': 3, 'Strong leather': 4, 'Advanced thread': 4, 'String': 8 } },
    { tier: 4, name: 'Legendary Backpack', capacity: 50, materials: { 'Crafting book': 1, 'Golden ant': 1, 'Advanced thread': 6, 'Steel plate': 4, 'Strong leather': 4 } },
];

const CRAFTING_RECIPES = {
    "melee_weapons": [
        { name: 'Baseball bat', rarity: 'common', description: 'A improvised cutting tool, dangerous in the right hands.', materials: { 'Metal piece': 2 } },
        { name: 'Cutting paper knife', rarity: 'rare', description: 'A improvised cutting tool, dangerous in the right hands.', materials: { 'Metal piece': 2, 'Wool': 1 } },
        { name: 'Camping axe', rarity: 'epic', description: 'Perfect for cutting through the jungle... or the city.', materials: { 'Steel plate': 1, 'Adhesive tape': 2, 'Rotten wood': 3, 'Worn axe head': 1 } },
        { name: 'Sword', rarity: 'mythical', description: 'A blade forged with precision and ancestral power.', materials: { 'Tsuka': 1, 'Rolled steel': 2, 'Strong leather': 5 } },
        { name: 'Katana', rarity: 'legendary', description: 'A blade forged with precision and ancestral power.', materials: { 'Tsuka': 1, 'Rolled steel': 2, 'Strong leather': 5 } },

    ],
    "guns": [
        { name: 'Toy gun', rarity: 'common', description: 'Unstable, but gets the job done.', materials: { 'Metal parts': 3, 'Wood': 2, 'Low-quality gunpowder': 2 } },
        { name: 'Pistol', rarity: 'rare', description: 'Fast, lethal, and easy to hide.', materials: { 'Steel plate': 4, 'Basic weapon sight': 1, 'Metal parts': 5, 'Refined gunpowder': 3 } },
        { name: 'Rifle', rarity: 'epic', description: 'An iconic, reliable and devastating assault rifle.', materials: { 'Military weapon magazine': 1, 'Tesseract': 1, 'Carbon fiber': 3 } },
        { name: 'Sniping rifle', rarity: 'mythical', description: 'An iconic, reliable and devastating sniper rifle.', materials: { 'Military weapon magazine': 1, 'Tesseract': 1, 'Carbon fiber': 3 } },
        { name: 'AK-47', rarity: 'legendary', description: 'An iconic, reliable and devastating assault rifle.', materials: { 'Military weapon magazine': 1, 'Tesseract': 1, 'Carbon fiber': 3 } },
    ]
};

const RARITY_EMOJIS = {
    common: { text: '<:common:1414131486730227762>', url: 'https://cdn.discordapp.com/emojis/1414131486730227762.png' },
    rare: { text: '<:rare:1414131535044542606>', url: 'https://cdn.discordapp.com/emojis/1414131535044542606.png' },
    epic: { text: '<:epic:1414131578690342978>', url: 'https://cdn.discordapp.com/emojis/1414131578690342978.png' },
    mythical: { text: '<:mythical:1414131587460894773>', url: 'https://cdn.discordapp.com/emojis/1414131587460894773.png' },
    legendary: { text: '<:legendary:1414131597854380052>', url: 'https://cdn.discordapp.com/emojis/1414131597854380052.png' },
    secret: { text: '<:secret:1414131604850216960>', url: 'https://cdn.discordapp.com/emojis/1414131604850216960.png' },
};

const ITEMS_BY_RARITY = {
    common: [ { name: 'Paper' }, { name: 'Old newspaper' }, { name: 'Wool' }, { name: 'Metal piece' }, { name: 'Rotten wood' }, { name: 'Plastic' }, { name: 'Razor blade' }, { name: 'Half-used Spray can' }, { name: 'Stick' } ],
    rare: [ { name: 'Wood' }, { name: 'Smooth stone' }, { name: 'String' }, { name: 'Low-quality gunpowder' }, { name: 'Magnifying glass' }, { name: 'Adhesive tape' }, { name: 'Bullets 9 mm' }, { name: 'Metal parts' } ],
    epic: [ { name: 'Steel plate' }, { name: 'Worn axe head' }, { name: 'Refined gunpowder' }, { name: 'Basic weapon sight' }, { name: 'Leather' }, { name: 'Bullets 223 Remington' } ],
    mythical: [ { name: 'Carbon fiber' }, { name: 'Advanced weapon sight' }, { name: 'Bullets 308 Winchester' }, { name: 'Sword handle' }, { name: 'Sharp rock' }, { name: 'Advanced thread' }, { name: 'Old zippo' }, { name: 'Strong leather' } ],
    legendary: [ { name: 'Kami' }, { name: 'Tsuka' }, { name: 'Military weapon magazine' }, { name: 'Strong wood' }, { name: 'Rolled steel' }, { name: 'Bullets 7-62x39 mm' }, { name: 'Crafting book' }, { name: 'Tesseract' }, { name: 'Golden ant' } ],
    secret: [ { name: 'Dryne Secret files' }, { name: 'Casino vault' }, { name: 'Cartel money' }, { name: 'Pandora box' } ]
};
const ITEM_RARITY_MAP = new Map();
for (const [rarity, items] of Object.entries(ITEMS_BY_RARITY)) {
    for (const item of items) {
        ITEM_RARITY_MAP.set(item.name, rarity);
    }
}

const ECONOMY_EMOJIS = {
    coin: { text: '🪙' },
    wallet: { text: '󠀠󠀠󠀠󠀠󠀠󠀠󠀠󠀠<:wallet:1247402638784139344>' },
    chips: { text: '󠀠󠀠󠀠󠀠󠀠󠀠󠀠󠀠<:chips:1247402636582125668>' },
};

const CRYPTOCURRENCIES = [
    { name: 'NoxCoin', ticker: 'NOX', logo: 'https://i.imgur.com/Bw24h2d.png', initialPrice: 150, volatility: 0.15 },
    { name: 'Quantum Token', ticker: 'QTM', logo: 'https://i.imgur.com/v86aG2b.png', initialPrice: 350, volatility: 0.30 },
    { name: 'Cypherium', ticker: 'CYPH', logo: 'https://i.imgur.com/xswb7T2.png', initialPrice: 80, volatility: 0.20 },
    { name: 'Solaris', ticker: 'SLR', logo: 'https://i.imgur.com/8v9Z8E3.png', initialPrice: 220, volatility: 0.12 },
    { name: 'Portal Protocol', ticker: 'PORT', logo: 'https://i.imgur.com/3h2b5T7.png', initialPrice: 500, volatility: 0.45 },
    { name: 'AstroPup', ticker: 'PUP', logo: 'https://i.imgur.com/pC2zG7s.png', initialPrice: 25, volatility: 0.85 }, // Memecoin de alta volatilidad
];

const CRYPTO_MARKET_CONFIG = {
    updateInterval: 5 * 60 * 1000, // 5 minutos
    stateChangeInterval: 60 * 60 * 1000, // 1 hora
    commissionFee: 0.02, // 2% Gas Fee
    historyLength: 24, 
};

const SLOT_MACHINES = {
    basic: {
        name: 'Basic Slot Machine',
        description: 'A rusty but reliable machine. Perfect for beginners.',
        cost: 250,
        reels: [
            ['<:chocolate:1412871305807790131>', '<:charred_orange:1412871298190934087>', '<:toasted_marshmallow:1412871391845285918>', '<:banana_peel:1412874196458930206>', '<:corn_kernel:1412874333281456253>', '<:potato:1412874414042910862>'],
            ['<:chocolate:1412871305807790131>', '<:charred_orange:1412871298190934087>', '<:toasted_marshmallow:1412871391845285918>', '<:banana_peel:1412874196458930206>', '<:corn_kernel:1412874333281456253>', '<:potato:1412874414042910862>'],
            ['<:chocolate:1412871305807790131>', '<:charred_orange:1412871298190934087>', '<:toasted_marshmallow:1412871391845285918>', '<:banana_peel:1412874196458930206>', '<:corn_kernel:1412874333281456253>', '<:potato:1412874414042910862>'],
        ],
        payouts: {
            '<:chocolate:1412871305807790131>': 2, '<:charred_orange:1412871298190934087>': 2, '<:toasted_marshmallow:1412871391845285918>': 3, '<:banana_peel:1412874196458930206>': 3, '<:corn_kernel:1412874333281456253>': 5, '<:potato:1412874414042910862>': 5,
        },
        jackpot: { symbol: '<:potato:1412874414042910862>', multiplier: 100 }
    },
    advanced: {
        name: 'Advanced Slot Machine',
        description: 'Perfect for those who seek greater challenges.',
        cost: 3200,
        reels: [
            ['<:candy:1412872696835997726>', '<:donut:1412871400586477641>', '<:popsicle:1412871365328900167>', '<:candy_wrapper:1412871383100162050>', '<:lolly:1412871315261489292>', '<:lollipop_red:1412871333267640542>'],
            ['<:candy:1412872696835997726>', '<:donut:1412871400586477641>', '<:popsicle:1412871365328900167>', '<:candy_wrapper:1412871383100162050>', '<:lolly:1412871315261489292>', '<:lollipop_red:1412871333267640542>'],
            ['<:candy:1412872696835997726>', '<:donut:1412871400586477641>', '<:popsicle:1412871365328900167>', '<:candy_wrapper:1412871383100162050>', '<:lolly:1412871315261489292>', '<:lollipop_red:1412871333267640542>'],
        ],
        payouts: {
            '<:lolly:1412871315261489292>': 3, '<:candy_wrapper:1412871383100162050>': 6, '<:donut:1412871400586477641>': 9, '<:candy:1412872696835997726>': 13, '<:popsicle:1412871365328900167>': 24, '<:lollipop_red:1412871333267640542>': 40,
        },
        jackpot: { symbol: '<:lollipop_red:1412871333267640542>', multiplier: 180 }
    },
    luxury: {
        name: 'Luxury Slot Machine',
        description: 'Made of gold and dreams. High bets, legendary prizes.',
        cost: 6000,
        reels: [
            ['<:orange:1412871268721492008>', '<:strawberry:1412871227399213076>', '<:coconut:1412871250123952389>', '<:apple:1412871207744966756>', '<:banana:1412871218151030794>', '<:lemon:1412871198894723173>'],
            ['<:orange:1412871268721492008>', '<:strawberry:1412871227399213076>', '<:coconut:1412871250123952389>', '<:apple:1412871207744966756>', '<:banana:1412871218151030794>', '<:lemon:1412871198894723173>'],
            ['<:orange:1412871268721492008>', '<:strawberry:1412871227399213076>', '<:coconut:1412871250123952389>', '<:apple:1412871207744966756>', '<:banana:1412871218151030794>', '<:lemon:1412871198894723173>'],
        ],
        payouts: {
            '<:banana:1412871218151030794>': 4, '<:apple:1412871207744966756>': 6, '<:strawberry:1412871227399213076>': 10, '<:orange:1412871268721492008>': 20, '<:coconut:1412871250123952389>': 25, '<:lemon:1412871198894723173>': 30,
        },
        jackpot: { symbol: '<:lemon:1412871198894723173>', multiplier: 200 }
    },
    ultimate: {
        name: 'Ultimate Slot Machine',
        description: 'The pinnacle of luxury. Unmatched rewards await.',
        cost: 100000,
        reels: [
            ['<:raspberry:1412871238770098218>', '<:cloudberry:1412871258193924249>', '<:grape:1412871178888020079>', '<:pineapple:1412871375596814377>', '<:peach:1412871278687424532>', '<:cherry:1412871190766424104>'],
            ['<:raspberry:1412871238770098218>', '<:cloudberry:1412871258193924249>', '<:grape:1412871178888020079>', '<:pineapple:1412871375596814377>', '<:peach:1412871278687424532>', '<:cherry:1412871190766424104>'],
            ['<:raspberry:1412871238770098218>', '<:cloudberry:1412871258193924249>', '<:grape:1412871178888020079>', '<:pineapple:1412871375596814377>', '<:peach:1412871278687424532>', '<:cherry:1412871190766424104>'],
        ],
        payouts: {
            '<:peach:1412871278687424532>': 6, '<:pineapple:1412871375596814377>': 9, '<:cloudberry:1412871258193924249>': 11, '<:raspberry:1412871238770098218>': 21, '<:grape:1412871178888020079>': 24, '<:cherry:1412871190766424104>': 70,
        },
        jackpot: { symbol: '<:cherry:1412871190766424104>', multiplier: 120 }
    },
};

const SCRATCH_TICKETS = {
    bronze: {
        name: 'Cartón de Bronce',
        cost: 250,
        gridSize: 9,
        // Símbolos y sus pesos (más alto = más común)
        symbols: [
            { symbol: '💀', weight: 100 }, // SÍMBOLO PERDEDOR AÑADIDO
            { symbol: '🍒', weight: 40 },
            { symbol: '🍋', weight: 30 },
            { symbol: '🍊', weight: 20 },
            { symbol: '🔔', weight: 10 },
            { symbol: '💎', weight: 5 },
        ],
        // Multiplicador sobre el costo del cartón
        payouts: {
            '🍒': 1,   // Recuperas lo apostado
            '🍋': 2,   // Duplicas
            '🍊': 5,
            '🔔': 10,
            '💎': 50,  // El premio gordo
        }
    },
    silver: {
        name: 'Cartón de Plata',
        cost: 1000,
        gridSize: 9,
        symbols: [
            { symbol: '💀', weight: 120 }, // SÍMBOLO PERDEDOR AÑADIDO
            { symbol: '🍇', weight: 40 },
            { symbol: '🍉', weight: 30 },
            { symbol: '🍀', weight: 20 },
            { symbol: ' BAR', weight: 10 },
            { symbol: '👑', weight: 5 },
        ],
        payouts: {
            '🍇': 1.5,
            '🍉': 3,
            '🍀': 7,
            ' BAR': 15,
            '👑': 100,
        }
    },
    gold: {
        name: 'Cartón de Oro',
        cost: 5000,
        gridSize: 9,
        symbols: [
            { symbol: '💀', weight: 180 }, // SÍMBOLO PERDEDOR AÑADIDO
            { symbol: '💰', weight: 40 },
            { symbol: '⭐', weight: 30 },
            { symbol: ' 7', weight: 20 },
            { symbol: '💍', weight: 10 },
            { symbol: '🏆', weight: 5 },
        ],
        payouts: {
            '💰': 2,
            '⭐': 5,
            ' 7': 20,
            '💍': 100,
            '🏆': 500, // ¡El legendario Mega-Jackpot!
        }
    }
};

const WHEEL_OF_FORTUNE = {
    default: {
        name: 'Rueda de la Fortuna',
        cost: 0,
        segments: [
            { name: '100 $', type: 'win', value: 100, color: '#C2C5A5' }, // Verde Salvia
            { name: '500 $', type: 'win', value: 500, color: '#F0EAD6' }, // Crema
            { name: '200 $', type: 'win', value: 200, color: '#C2C5A5' },
            { name: '1000 $', type: 'win', value: 1000, color: '#F0EAD6' },
            { name: '300 $', type: 'win', value: 300, color: '#C2C5A5' },
            { name: 'JACKPOT', type: 'win', value: 5000, color: '#F0EAD6' },
            { name: '100 $', type: 'win', value: 100, color: '#C2C5A5' },
            { name: '500 $', type: 'win', value: 500, color: '#F0EAD6' },
            { name: '200 $', type: 'win', value: 200, color: '#C2C5A5' },
            { name: '1000 $', type: 'win', value: 1000, color: '#F0EAD6' },
            { name: '300 $', type: 'win', value: 300, color: '#C2C5A5' },
            { name: 'Nada', type: 'nothing', value: 0, color: '#F0EAD6' },
        ].map(s => ({ ...s, textColor: '#4A4A4A' })) // El color del texto se ajustará en el renderer
    }
};

const ROULETTE_CONFIG = {
    wheel: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
    colors: {
        red: [32, 19, 21, 25, 34, 27, 36, 30, 23, 5, 16, 1, 14, 9, 18, 7, 12, 3],
        black: [15, 4, 2, 17, 6, 13, 11, 8, 10, 24, 33, 20, 31, 22, 29, 28, 35, 26],
        green: [0]
    },
    columns: {
        '1st': [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
        '2nd': [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
        '3rd': [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]
    },
    payouts: {
        number: 35,
        color: 2,
        even_odd: 2,
        low_high: 2,
        dozen: 2,
        column: 2
    }
};

const BLACKJACK_CONFIG = {
    // deck: ['❤️', '♦️', '♣️', '♠️'], 
    values: {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
        'J': 10, 'Q': 10, 'K': 10, 'A': 11
    },
    dealer_stands_on: 17,
    blackjack_payout: 1.5,
};

// custom cards
const CUSTOM_CARDS = {
    // Spades
    '♠️A': '<:spade_ace:1408248514143715350>',
    '♠️2': '<:spade_2:1408248366709866578>',
    '♠️3': '<:spade_3:1408248380412530860>',
    '♠️4': '<:spade_4:1408248395260497950>',
    '♠️5': '<:spade_5:1408248411605696573>',
    '♠️6': '<:spade_6:1408248425534984233>',
    '♠️7': '<:spade_7:1408248440709845002>',
    '♠️8': '<:spade_8:1408248456811646976>',
    '♠️9': '<:spade_9:1408248477141700669>',
    '♠️10': '<:spade_10:1408248497173430304>',
    '♠️J': '<:spade_jack:1408248536901877882>',
    '♠️Q': '<:spade_queen:1408248550994743426>',
    '♠️K': '<:spade_king:1408248565226016808>',
    // Hearts
    '❤️A': '<:heart_ace:1411388407212544110>',
    '❤️2': '<:heart_2:1408247762952130691>',
    '❤️3': '<:heart_3:1408247786964647977>',
    '❤️4': '<:heart_4:1408247807583850576>',
    '❤️5': '<:heart_5:1408247847026954341>',
    '❤️6': '<:heart_6:1408247896456958092>',
    '❤️7': '<:heart_7:1408247910247956550>',
    '❤️8': '<:heart_8:1408247926886633563>',
    '❤️9': '<:heart_9:1408247941784928276>',
    '❤️10': '<:heart_10:1408247957480017921>',
    '❤️J': '<:heart_jack:1408247976023035975>',
    '❤️Q': '<:heart_queen:1408247996075868331>',
    '❤️K': '<:heart_king:1408248019438276728>',
    // Clubs
    '♣️A': '<:club_ace:1408247738822295552>',
    '♣️2': '<:club_2:1408247438795604008>',
    '♣️3': '<:club_3:1408247457955184690>',
    '♣️4': '<:club_4:1408247474883264603>',
    '♣️5': '<:club_5:1408247491006169169>',
    '♣️6': '<:club_6:1408247509524156468>',
    '♣️7': '<:club_7:1408247532462801170>',
    '♣️8': '<:club_8:1408247555028160564>',
    '♣️9': '<:club_9:1411386694934073344>',
    '♣️10': '<:club_10:1411386506035335287>',
    '♣️J': '<:club_jack:1408247639115563108>',
    '♣️Q': '<:club_queen:1408247702218870876>',
    '♣️K': '<:club_king:1408247721822916628>',
    // Diamonds
    '♦️A': '<:diamond_ace:1408248327513833564>',
    '♦️2': '<:diamond_2:1408247762952130691>',
    '♦️3': '<:diamond_3:1408247786964647977>',
    '♦️4': '<:diamond_4:1408247807583850576>',
    '♦️5': '<:diamond_5:1408247847026954341>',
    '♦️6': '<:diamond_6:1408247896456958092>',
    '♦️7': '<:diamond_7:1408247910247956550>',
    '♦️8': '<:diamond_8:1408247926886633563>',
    '♦️9': '<:diamond_9:1408247941784928276>',
    '♦️10': '<:diamond_10:1408247957480017921>',
    '♦️J': '<:diamond_jack:1408247976023035975>',
    '♦️Q': '<:diamond_queen:1408247996075868331>',
    '♦️K': '<:diamond_king:1408248327513833564>',

    // hidden card
    'HIDDEN': '<:card_back:1408248583773356123>'
};

const MINES_CONFIG = {
    getMultiplier: (gridSize, mines, gemsFound) => {
        if (gemsFound === 0) return 1.0;
        const totalTiles = gridSize * gridSize;
        const combinationsTotal = (n, k) => {
            if (k < 0 || k > n) return 0;
            let res = 1;
            for (let i = 0; i < k; i++) {
                res = res * (n - i) / (i + 1);
            }
            return res;
        };
        const houseEdge = 0.98;
        const multiplier = houseEdge * combinationsTotal(totalTiles, gemsFound) / combinationsTotal(totalTiles - mines, gemsFound);
        return parseFloat(multiplier.toFixed(2));
    },
    gridOptions: {
        '3x3': { size: 3, minMines: 1, maxMines: 8 },
        '4x4': { size: 4, minMines: 1, maxMines: 15 },
    }
};

const RACE_CONFIG = {
    min_bet: 50,
    max_bet: 10000,
    betting_window: 60000,
    track_length: 20,
    payout_multiplier: 3.5,
    racers: [
        { id: 'turtle', name: 'Turtle', emoji: '<:turtle:1407170863312277596>', color: 0x2ECC71 },
        { id: 'snail', name: 'Snail', emoji: '<:snail:1407170889518419978>', color: 0xE91E63 },
        { id: 'crab', name: 'Crab', emoji: '<:crab:1407170916122886325>', color: 0xE67E22 },
        { id: 'frog', name: 'Frog', emoji: '<:frog:1407170970078285974>', color: 0x3498DB },
    ]
};

const RARITY_CHANCES = [
    { rarity: 'secret', chance: 0.0001, color: 0x000000 },
    { rarity: 'legendary', chance: 0.005, color: 0xFF4500 },
    { rarity: 'mythical', chance: 0.025, color: 0xFFD700 },
    { rarity: 'epic', chance: 0.10, color: 0x9400D3 },
    { rarity: 'rare', chance: 0.25, color: 0x0099FF },
    { rarity: 'common', chance: 1.0, color: 0x99AAB5 },
];

const EMOJIS = {
    coin: { text: '<:coin:1407161162939891853>', id: '1407161162939891853' },
    coinstack: { text: '<:coinstack:1407161148301643886>', id: '1407161148301643886' },
    backpack1: { text: '<:backpack1:1407161220208922784>', id: '1407161220208922784' },
    backpack2: { text: '<:backpack2:1407161235295703137>', id: '1407161235295703137' },
    backpack3: { text: '<:backpack3:1407161250021900339>', id: '1407161250021900339' },
    backpack4: { text: '<:backpack4:1407161262898413619>', id: '1407161262898413619' },
    back: { text: '<:back:1408185854807249037>', id: '1408185854807249037' },
    previous: { text: '<:previous:1408185842110959797>', id: '1408185842110959797' },
    next: { text: '<:next:1408185828353769522>', id: '1408185828353769522' },
    bank: { text: '<:bank:1407167037222162433>', id: '1407167037222162433' },
    wallet: { text: '<:wallet:1407167060521521266>', id: '1407167060521521266' },
    pickaxe: { text: '<:pickaxe:1407167097250906174>', id: '1407167097250906174' },
    news: { text: '<:news:1407167136094486549>', id: '1407167136094486549' },
    cloud: { text: '<:cloud:1411932454205259870>', id: '1411932454205259870' },
    fire: { text: '<:fire:1407167160496816209>', id: '1407167160496816209' },
    profile: { text: '<:profile:1413348490473635921>', id: '1413348490473635921' },
    food1: { text: '<:food1:1407167211340300419>', id: '1407167211340300419' },
    food2: { text: '<:food2:1407167547773554859>', id: '1407167547773554859' },
    food3: { text: '<:food3:1407167568674029638>', id: '1407167568674029638' },
    food4: { text: '<:food4:1407167589775441952>', id: '1407167589775441952' },
    tablet: { text: '<:tablet:1407167722403659806>', id: '1407167722403659806' },
    phone: { text: '<:phone:1407170556935278622>', id: '1407170556935278622' },
    crupier: { text: '<:crupier:1407170596735029288>', id: '1407170596735029288' },
    chips: { text: '<:chips:1407170624496992286>', id: '1407170624496992286' },
    cards: { text: '<:cards:1407170654733865062>', id: '1407170654733865062' },
    justice: { text: '<:justice:1407170682248368298>', id: '1407170682248368298' },
    lock: { text: '<:lock:1407170715949465691>', id: '1407170715949465691' },
    unlock: { text: '<:unlock:1407170743619555328>', id: '1407170743619555328' },
    slot: { text: '<:slot:1407170781728997489>', id: '1407170781728997489' },
    casino: { text: '<:casino:1407170816185073674>', id: '1407170816185073674' },
    turtle: { text: '<:turtle:1407170863312277596>', id: '1407170863312277596' },
    snail: { text: '<:snail:1407170889518419978>', id: '1407170889518419978' },
    crab: { text: '<:crab:1407170916122886325>', id: '1407170916122886325' },
    snake: { text: '<:snake:1407170936393695303>', id: '1407170936393695303' },
    frog: { text: '<:frog:1407170970078285974>', id: '1407170970078285974' },
    chicken: { text: '<:chicken:1411816274975133779>', id: '1411816274975133779' },
    spaceman: { text: '<:spaceman:1411928010247901204>', id: '1411928010247901204' },
    nebula: { text: '<:nebula:1411928897792245771>', id: '1411928897792245771' },
    supernova: { text: '<:supernova:1411928908470685790>', id: '1411928908470685790' },
    rocket: { text: '<:rocket:1411928016254140538>', id: '1411928016254140538' },
    airplane: { text: '<:airplane:1411933955573158031>', id: '1411933955573158031' },
    road: { text: '<:road:1411817716888768513>', id: '1411817716888768513' },
    road_safe: { text: '<:road:1411817716888768513>', id: '1411817716888768513' },
    road_empty: { text: '<:road:1411817716888768513>', id: '1411817716888768513' },
    refresh: { text: '<:refresh:1415154555343339540>', id: '1415154555343339540' },
    bomb: { text: '<:bomb:1407171029788524726>', id: '1407171029788524726' },
    diamond: { text: '<:diamond:1407171050885742714>', id: '1407171050885742714' },
    money: { text: '<:money:1407174341715562496>', id: '1407174341715562496' },
    plus: { text: '<:plus:1407572601676628028>', id: '1407572601676628028' },
    minus: { text: '<:minus:1413351284710310002>', id: '1413351284710310002' },
    close: { text: '<:close:1413348344830361610>', id: '1413348344830361610' },
    check: { text: '<:check:1413348060020609176>', id: '1413348060020609176' },
    coinbag: { text: '<:coinbag:1407178178102951977>', id: '1407178178102951977' },
    cuttingknife: { text: '<:cuttingknife:1407182118710411379>', id: '1407182118710411379' },
    axe: { text: '<:axe:1407182129611149425>', id: '1407182129611149425' },
    katana: { text: '<:katana:1407182142626074698>', id: '1407182142626074698' },
    sword: { text: '<:sword:1407182156618268683>', id: '1407182156618268683' },
    rifle: { text: '<:rifle:1407182175668932639>', id: '1407182175668932639' },
    painball: { text: '<:painball:1407182191343042760>', id: '1407182191343042760' },
    pistol: { text: '<:pistol:1407182203095482460>', id: '1407182203095482460' },
    toygun: { text: '<:toygun:1407182518913990706>', id: '1407182518913990706' },
    ak47: { text: '<:ak47:1407182844442185759>', id: '1407182844442185759' },
    done: { text: '<:done:1407572263779172352>', id: '1407572263779172352' },
    run: { text: '<:run:1407205196005769246>', id: '1407205196005769246' },
    punch: { text: '<:punch:1407205207481385081>', id: '1407205207481385081' },
    backpackdefault: { text: '<:backpackdefault:1407538274993438780>', id: '1407538274993438780' },
    click: { text: '<:click:1407557478580879370>', id: '1407557478580879370' },
    error: { text: '<:error:1407572517186703400>', id: '1407572517186703400' },
    pen: { text: '<:pen:1408112874739466310>', id: '1408112874739466310' },
    paperplane: { text: '<:paperplane:1408112882117247077>', id: '1408112882117247077' },
    sword1: { text: '<:sword1:1408119507079266315>', id: '1408119507079266315' },
    sword2: { text: '<:sword2:1408119518529716276>', id: '1408119518529716276' },
    pandorabox: { text: '<:pandorabox:1408120108899111054>', id: '1408120108899111054' },
    box: { text: '<:box:1408120137542008833>', id: '1408120137542008833' },
    pricetag: { text: '<:pricetag:1408120996220895394>', id: '1408120996220895394' },
    discount_tag: { text: '<:discount_tag:1416531046375231548>', id: '1416531046375231548' },
    basket: { text: '<:basket:1408121015762161696>', id: '1408121015762161696' },
    home: { text: '<:home:1408177991577632878>', id: '1408177991577632878' },
    waiting: { text: '<:waiting:1408241004586336267>', id: '1408241004586336267' },
    thieft1: { text: '<:thieft1:1410414009009569863>', id: '1410414009009569863' },
    thieft2: { text: '<:thieft2:1410414000117649448>', id: '1410414000117649448' },
    thieft3: { text: '<:thieft3:1410414001271079126>', id: '1410414001271079126' },
    scroll: { text: '<:scroll:1413344818570199050>', id: '1413344818570199050' },
    dumpster_fire: { text: '<:dumpster_fire:1413344868042014770>', id: '1413344868042014770' },
    verified: { text: '<:verified:1413348544903118908>', id: '1413348544903118908' },
    checkmark: { text: '<:checkmark:1413351472888021052>', id: '1413351472888021052' },
    prohibited: { text: '<:prohibited:1413351574356492348>', id: '1413351574356492348' },
    shield: { text: '<:shield:1413351932290138173>', id: '1413351932290138173' },
    emergency: { text: '<:emergency:1413351965949169675>', id: '1413351965949169675' },
    nuke: { text: '<:nuke:1413352343063363614>', id: '1413352343063363614' },
    xp: { text: '<:xp:1413352414018273361>', id: '1413352414018273361' },
    red_button: { text: '<:red_button:1413352478866542602>', id: '1413352478866542602' },
    switch_off: { text: '<:switch_off:1413352538664603648>', id: '1413352538664603648' },
    switch_on: { text: '<:switch_on:1413352563507724368>', id: '1413352563507724368' },
    labubu: { text: '<:labubu:1413352630549348514>', id: '1413352630549348514' },
    diamond_purple: { text: '<:diamond_purple:1413352661532541060>', id: '1413352661532541060' },
    settings: { text: '<:settings:1413352791748907098>', id: '1413352791748907098' },
    info: { text: '<:info:1413352812955308063>', id: '1413352812955308063' },
    warning: { text: '<:warning:1413994935547592794>', id: '1413994935547592794' },
    message: { text: '<:message:1413998265573048380>', id: '1413998265573048380' },
    bookmark: { text: '<:bookmark:1414053084103184435>', id: '1414053084103184435' },
    calendar: { text: '<:calendar:1414053092324020345>', id: '1414053092324020345' },
    verified_shield: { text: '<:verified_shield:1414053102536884416>', id: '1414053102536884416' },
    city: { text: '<:city:1414053558239629402>', id: '1414053558239629402' },
    caution: { text: '<:caution:1407572540267954186>', id: '1407572540267954186' },
    cash: { text: '<:cash:1415153375238033561>', id: '1415153375238033561' },
    discount: { text: '<:discount:1415154140211838996>', id: '1415154140211838996' },
    change: { text: '<:change:1415173625417564203>', id: '1415173625417564203' },
    trophy: { text: '<:trophy:1415175274093482045>', id: '1415175274093482045' },
};

module.exports = {
    WEAPON_STATS,
    ENCOUNTERS,
    ITEM_PRICES,
    BACKPACK_UPGRADES,
    SLOT_MACHINES,
    ROULETTE_CONFIG,
    BLACKJACK_CONFIG,
    MINES_CONFIG,
    RACE_CONFIG,
    EMOJIS,
    CRAFTING_RECIPES,
    WEAPON_PRICES,
    ITEMS_BY_RARITY,
    RARITY_EMOJIS,
    ITEM_RARITY_MAP,
    STEAL_CONFIG,
    RARITY_CHANCES,
    CUSTOM_CARDS,
    SCRATCH_TICKETS,
    WHEEL_OF_FORTUNE,
    STOCK_RANGES,
    SHOP_RARITY_WEIGHTS,
    SHOP_DEAL_OF_THE_DAY_DISCOUNT,
    CRYPTOCURRENCIES,
    CRYPTO_MARKET_CONFIG,
    ECONOMY_EMOJIS,
};