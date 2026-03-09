/**
 * Fatimiyah Animations — YouTube Auto-Fetch Script V3
 * Fetches latest videos from @Fatimiyah_Animations YouTube channel
 * Strategy: rss2json API → multiple CORS proxies → fallback data
 */

(function () {
    'use strict';

    // YouTube Channel ID for @Fatimiyah_Animations
    const CHANNEL_ID = 'UCnVIMISPmlMpLjPgjMNF2bg';
    const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

    const MAX_VIDEOS = 6;

    // Real Fatimiyah Animations videos as fallback
    const FALLBACK_VIDEOS = [
        {
            id: 'r_IT3p3yG8s',
            title: "Hasan's First Fast: Learning the True Meaning of Fasting",
            thumbnail: 'https://i.ytimg.com/vi/r_IT3p3yG8s/hqdefault.jpg',
            published: '2025-03-01'
        },
        {
            id: 'goWZKeJ-9p0',
            title: 'The Complete Life of Imam Hasan (a.s.) | Biography | Fatimiyah Animations',
            thumbnail: 'https://i.ytimg.com/vi/goWZKeJ-9p0/hqdefault.jpg',
            published: '2025-02-15'
        },
        {
            id: 'VgLuKmmqCRo',
            title: "The Imam's Little Helpers – Celebrating Imam al-Mahdi (a.s.) with Good Deeds",
            thumbnail: 'https://i.ytimg.com/vi/VgLuKmmqCRo/hqdefault.jpg',
            published: '2025-02-01'
        },
        {
            id: 'MgpPHEUZNps',
            title: 'The Three Days of Hunger: A Story of Imam Ali (a.s.) & Lady Fatimah (s.a.)',
            thumbnail: 'https://i.ytimg.com/vi/MgpPHEUZNps/hqdefault.jpg',
            published: '2025-01-20'
        },
        {
            id: 'GZ4ZLaifRxM',
            title: 'The Silver Smile of Mahe Ramadan | Moon Sighting Story for Kids',
            thumbnail: 'https://i.ytimg.com/vi/GZ4ZLaifRxM/hqdefault.jpg',
            published: '2025-01-10'
        },
        {
            id: 'Ej8vCHh8Tcg',
            title: "The Hidden Imam's Light | A Kids Story of Imam Mahdi (a.s.)",
            thumbnail: 'https://i.ytimg.com/vi/Ej8vCHh8Tcg/hqdefault.jpg',
            published: '2024-12-28'
        }
    ];

    /**
     * Strategy 1: rss2json.com — dedicated RSS-to-JSON service (no CORS issues)
     */
    async function fetchViaRss2Json() {
        const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}&count=${MAX_VIDEOS}`;
        try {
            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            if (data.status !== 'ok' || !data.items || data.items.length === 0) return null;

            return data.items.map(function (item) {
                // Extract video ID from the YouTube link
                const link = item.link || '';
                const match = link.match(/[?&]v=([^&]+)/) || item.guid?.match(/([a-zA-Z0-9_-]{11})$/);
                const videoId = match ? match[1] : '';
                if (!videoId) return null;

                return {
                    id: videoId,
                    title: item.title || 'Untitled',
                    thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    published: item.pubDate || ''
                };
            }).filter(Boolean).slice(0, MAX_VIDEOS);
        } catch (err) {
            console.warn('rss2json failed:', err.message);
            return null;
        }
    }

    /**
     * Parse YouTube RSS XML feed
     */
    function parseRSSFeed(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'text/xml');
        const entries = xml.querySelectorAll('entry');
        const videos = [];

        entries.forEach(function (entry, index) {
            if (index >= MAX_VIDEOS) return;

            const videoIdEl = entry.querySelector('videoId');
            const videoId = videoIdEl ? videoIdEl.textContent : '';
            const titleEl = entry.querySelector('title');
            const title = titleEl ? titleEl.textContent : 'Untitled';
            const publishedEl = entry.querySelector('published');
            const published = publishedEl ? publishedEl.textContent : '';
            const thumbEl = entry.querySelector('group thumbnail');
            const thumbnail = thumbEl
                ? thumbEl.getAttribute('url')
                : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            if (videoId) {
                videos.push({ id: videoId, title, thumbnail, published });
            }
        });

        return videos;
    }

    /**
     * Strategy 2: Try multiple CORS proxies for the raw RSS XML feed
     */
    async function fetchViaCorsProxies() {
        const CORS_PROXIES = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(RSS_URL)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(RSS_URL)}`,
            `https://corsproxy.io/?url=${encodeURIComponent(RSS_URL)}`,
            `https://cors.lol/?url=${encodeURIComponent(RSS_URL)}`,
            `https://test.cors.workers.dev/?${encodeURIComponent(RSS_URL)}`
        ];

        for (const proxyUrl of CORS_PROXIES) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout per proxy

                const response = await fetch(proxyUrl, {
                    headers: { 'Accept': 'application/xml, text/xml, */*' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) continue;

                const text = await response.text();
                if (!text.includes('<feed') && !text.includes('<entry')) continue;

                const videos = parseRSSFeed(text);
                if (videos.length > 0) {
                    console.info('✅ YouTube feed fetched via:', proxyUrl.split('?')[0]);
                    return videos;
                }
            } catch (err) {
                // Silently continue to next proxy
                continue;
            }
        }
        return null;
    }

    /**
     * Strategy 3: allorigins JSON wrapper (returns JSON with 'contents' field)
     */
    async function fetchViaAllOriginsJson() {
        const url = `https://api.allorigins.win/get?url=${encodeURIComponent(RSS_URL)}`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) return null;

            const data = await response.json();
            if (!data.contents) return null;

            const videos = parseRSSFeed(data.contents);
            if (videos.length > 0) {
                console.info('✅ YouTube feed fetched via allorigins JSON wrapper');
                return videos;
            }
        } catch (err) {
            console.warn('allorigins JSON failed:', err.message);
        }
        return null;
    }

    /**
     * Master fetch — tries all strategies in order
     */
    async function fetchVideos() {
        // Strategy 1: rss2json (most reliable, purpose-built)
        let videos = await fetchViaRss2Json();
        if (videos && videos.length > 0) {
            console.info('✅ YouTube feed fetched via rss2json');
            return videos;
        }

        // Strategy 2: CORS proxies for raw XML
        videos = await fetchViaCorsProxies();
        if (videos && videos.length > 0) return videos;

        // Strategy 3: allorigins JSON wrapper
        videos = await fetchViaAllOriginsJson();
        if (videos && videos.length > 0) return videos;

        console.info('⚠️ All live-fetch strategies failed — using fallback data');
        return null;
    }

    /**
     * Format date
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
        } catch { return dateStr; }
    }

    /**
     * Render featured video
     */
    function renderFeaturedVideo(video) {
        const container = document.getElementById('featured-video');
        if (!container) return;

        container.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${video.id}?rel=0&modestbranding=1"
                title="${video.title}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                loading="lazy"
            ></iframe>
        `;
    }

    /**
     * Create a video card
     */
    function createVideoCard(video) {
        const card = document.createElement('a');
        card.href = `https://www.youtube.com/watch?v=${video.id}`;
        card.className = 'video-card glass-card reveal';
        card.style.textDecoration = 'none';
        
        // Open video in modal instead of new tab
        card.addEventListener('click', function(e) {
            e.preventDefault();
            openVideoModal(video);
        });

        const thumb = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

        card.innerHTML = `
            <div class="video-thumbnail">
                <img src="${thumb}" alt="${video.title}" loading="lazy"
                     onerror="this.src='https://i.ytimg.com/vi/${video.id}/hqdefault.jpg'">
                <div class="video-play-btn">
                    <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"></polygon></svg>
                </div>
            </div>
            <div class="video-info">
                <h4>${video.title}</h4>
                <span class="video-date">${formatDate(video.published)}</span>
            </div>
        `;

        return card;
    }

    /**
     * Render video grid
     */
    function renderVideoGrid(videos) {
        const gridContainer = document.getElementById('video-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';

        const gridVideos = videos.slice(1, MAX_VIDEOS);

        gridVideos.forEach(function (video) {
            gridContainer.appendChild(createVideoCard(video));
        });

        // Trigger scroll animations for new elements
        if (window.initScrollReveal) window.initScrollReveal();
    }

    /**
     * Inline Video Modal Player
     */
    function openVideoModal(video) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'custom-video-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', zIndex: '99999',
            background: 'rgba(3, 7, 18, 0.9)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: '0', transition: 'opacity 0.3s ease', padding: '20px'
        });

        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        Object.assign(closeBtn.style, {
            position: 'absolute', top: '24px', right: '32px',
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontSize: '24px', width: '48px', height: '48px',
            borderRadius: '50%', cursor: 'pointer', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s'
        });
        closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(232,99,43,0.8)';
        closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255,255,255,0.1)';

        // Create video container
        const videoWrapper = document.createElement('div');
        Object.assign(videoWrapper.style, {
            width: '100%', maxWidth: '1000px', aspectRatio: '16/9',
            background: '#000', borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            border: '1px solid rgba(255,255,255,0.1)',
            transform: 'scale(0.95)', transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        });

        videoWrapper.innerHTML = `
            <iframe width="100%" height="100%" 
                src="https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1" 
                title="${video.title}" frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>
        `;

        // Assemble and append
        overlay.appendChild(closeBtn);
        overlay.appendChild(videoWrapper);
        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            videoWrapper.style.transform = 'scale(1)';
        });

        // Close logic
        const closeModal = () => {
            overlay.style.opacity = '0';
            videoWrapper.style.transform = 'scale(0.95)';
            setTimeout(() => document.body.removeChild(overlay), 300);
        };
        
        closeBtn.onclick = closeModal;
        overlay.onclick = (e) => { if(e.target === overlay) closeModal(); };
        
        // Escape key to close
        const escListener = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escListener);
            }
        };
        document.addEventListener('keydown', escListener);
    }

    /**
     * Main
     */
    async function init() {
        let videos = await fetchVideos();
        if (!videos || videos.length === 0) videos = FALLBACK_VIDEOS;

        if (videos.length > 0) renderFeaturedVideo(videos[0]);
        renderVideoGrid(videos);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
