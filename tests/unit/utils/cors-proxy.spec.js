import { fetchWithCorsProxy } from '../../../src/js/utils/cors-proxy.js';

function createHeaders(contentType) {
    return {
        get: (name) => (name === 'content-type' ? contentType : null)
    };
}

describe('utils/cors-proxy', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = jest.fn();
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        if (originalFetch) {
            global.fetch = originalFetch;
        } else {
            delete global.fetch;
        }
        jest.restoreAllMocks();
    });

    test('accepts direct application/ld+json responses as valid JSON', async () => {
        const directData = [{ 'o:id': 2 }];
        const fetchMock = global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: createHeaders('application/ld+json'),
            json: jest.fn().mockResolvedValue(directData),
            text: jest.fn()
        });

        const result = await fetchWithCorsProxy('https://maastricht.example/api/items');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            data: directData,
            method: 'direct',
            proxyUsed: null,
            success: true
        });
    });

    test('falls back to CodeTabs proxy after a browser-style CORS failure', async () => {
        const proxiedJson = JSON.stringify([{ 'o:id': 1092 }]);
        const fetchMock = global.fetch
            .mockRejectedValueOnce(new Error('Failed to fetch'))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: createHeaders('text/plain; charset=utf-8'),
                json: jest.fn(),
                text: jest.fn().mockResolvedValue(proxiedJson)
            });

        const result = await fetchWithCorsProxy('https://radboud.example/api/items?page=5&per_page=2');

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toBe(
            'https://api.codetabs.com/v1/proxy/?quest=https%3A%2F%2Fradboud.example%2Fapi%2Fitems%3Fpage%3D5%26per_page%3D2'
        );
        expect(result).toEqual({
            data: [{ 'o:id': 1092 }],
            method: 'proxy',
            proxyUsed: 'CodeTabs Proxy',
            success: true
        });
    });
});
