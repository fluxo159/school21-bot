// Attach signed Telegram identity to this app's API requests only.
(() => {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = (input, options = {}) => {
        const url = new URL(input instanceof Request ? input.url : input, location.href)
        if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
            const headers = new Headers(input instanceof Request ? input.headers : undefined)
            new Headers(options.headers).forEach((value, key) => headers.set(key, value))
            const initData = window.Telegram?.WebApp?.initData
            if (initData) headers.set('X-Telegram-Init-Data', initData)
            options = { ...options, headers }
        }
        return nativeFetch(input, options)
    }
})()
