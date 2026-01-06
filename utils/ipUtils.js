const normalizeIp = (ip) => {
    if (!ip) return 'Unknown';
    // If it's IPv6 loopback, return IPv4 loopback
    if (ip === '::1') return '127.0.0.1';
    // If it's an IPv6-mapped IPv4 address (e.g., ::ffff:192.168.1.1), extract the IPv4 part
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    return ip;
};

module.exports = { normalizeIp };
