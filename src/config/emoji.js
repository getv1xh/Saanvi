export const emoji = {
        check:     '✅',
        cross:     '❌',
        info:      'ℹ️',
        code:      '💻',
        activity:  '📊',
        settings:  '⚙️',
        warn:      '⚠️',

        upi:       '<:upi1:1517045940610138225><:upi2:1517045942983983104><:upi3:1517045944720556113>',

        money:     '<:money:1517061464538742846>',
        botlogo:   '<:botlogo:1517061463083061280>',
        paypal:    '<:paypal:1517065658314002543>',

        string:    '<:string:1517051299793862810>',

        p_id:      '<:p_id:1517058281351155722>',
        p_mention: '<:p_mention:1517058283062562920>',
        p_join:    '<:p_join:1517058280545976371>',
        p_counts:  '<:p_counts:1517058282412310599>',
        p_money:   '<:p_money:1517058282848653352>',
        p_clock:   '<:p_clock:1517058281871507537>',

        arrowup:   '<:arrowup:1516882251026010234>',
        arrowdown: '<:arrowdown:1516872424371650591>',
        plus:      '<:plus:1516882253039403320>',
        minus:     '<:minus:1516872427483959327>',

        get(name, fallback = '') {
                return this[name] || fallback;
        },
};

export default emoji;
