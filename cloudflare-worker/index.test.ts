import { describe, expect, it } from 'vitest';
import { isBlockedHost } from './index.js';

describe('isBlockedHost (SSRF guard)', () => {
	it('blocks loopback and named-localhost hosts', () => {
		expect(isBlockedHost('localhost')).toBe(true);
		expect(isBlockedHost('foo.localhost')).toBe(true);
		expect(isBlockedHost('127.0.0.1')).toBe(true);
		expect(isBlockedHost('0.0.0.0')).toBe(true);
		expect(isBlockedHost('::1')).toBe(true);
	});

	it('blocks private IPv4 ranges', () => {
		expect(isBlockedHost('10.1.2.3')).toBe(true); // 10.0.0.0/8
		expect(isBlockedHost('192.168.0.1')).toBe(true); // 192.168.0.0/16
		expect(isBlockedHost('172.16.5.5')).toBe(true); // 172.16.0.0/12
	});

	it('blocks the cloud metadata address', () => {
		expect(isBlockedHost('169.254.169.254')).toBe(true);
	});

	it('blocks unique-local IPv6', () => {
		expect(isBlockedHost('fd00::1')).toBe(true);
	});

	it('blocks IPv4-mapped IPv6 in dotted form', () => {
		expect(isBlockedHost('::ffff:127.0.0.1')).toBe(true);
		expect(isBlockedHost('::ffff:10.0.0.1')).toBe(true);
		expect(isBlockedHost('::ffff:8.8.8.8')).toBe(false); // mapped public addr stays allowed
	});

	it('allows public hosts and IPs', () => {
		expect(isBlockedHost('selectseo.in')).toBe(false);
		expect(isBlockedHost('example.com')).toBe(false);
		expect(isBlockedHost('8.8.8.8')).toBe(false);
		expect(isBlockedHost('172.32.0.1')).toBe(false); // just outside the 172.16.0.0/12 block
		expect(isBlockedHost('93.184.216.34')).toBe(false);
	});
});
