import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  type?: string;
  schema?: Record<string, any>;
  image?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

export function useSEO({ title, description, type = 'website', schema, image, twitterTitle, twitterDescription, twitterImage }: SEOProps) {
  const location = useLocation();

  useEffect(() => {
    // 1. Update Title
    const siteName = 'RealtyNow';
    const fullTitle = title
      ? (title.includes(siteName) ? title : `${title} | ${siteName}`)
      : 'RealtyNow — AI-Powered Real Estate Marketplace';
    document.title = fullTitle;

    // 2. Update Description
    const metaDesc = document.querySelector('meta[name="description"]');
    const descText = description || 'Premium real estate properties for sale and rent in India.';
    if (metaDesc) {
      metaDesc.setAttribute('content', descText);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = descText;
      document.head.appendChild(meta);
    }

    // 3. Update Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    const url = `https://realtynow.in${location.pathname}${location.search}`;
    if (canonical) {
      canonical.setAttribute('href', url);
    } else {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.setAttribute('href', url);
      document.head.appendChild(canonical);
    }

    // 4. Update Open Graph
    const updateOG = (propName: string, content: string) => {
      let meta = document.querySelector(`meta[property="${propName}"]`);
      if (meta) {
        meta.setAttribute('content', content);
      } else {
        meta = document.createElement('meta');
        meta.setAttribute('property', propName);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
      }
    };

    updateOG('og:title', fullTitle);
    updateOG('og:description', descText);
    updateOG('og:url', url);
    updateOG('og:type', type);
    updateOG('og:site_name', 'RealtyNow — All About Realty');
    updateOG('og:locale', 'en_IN');
    if (image) {
      updateOG('og:image', image);
      updateOG('og:image:secure_url', image);
      updateOG('og:image:width', '1200');
      updateOG('og:image:height', '630');
      updateOG('og:image:alt', title || 'RealtyNow Property');
    }

    // 4b. Update Twitter Card
    const updateTwitter = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (meta) {
        meta.setAttribute('content', content);
      } else {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
      }
    };
    const twImage = twitterImage || image;
    updateTwitter('twitter:card', twImage ? 'summary_large_image' : 'summary');
    updateTwitter('twitter:site', '@RealtyNow');
    updateTwitter('twitter:title', twitterTitle || fullTitle);
    updateTwitter('twitter:description', twitterDescription || descText);
    if (twImage) updateTwitter('twitter:image', twImage);

    // 5. Update JSON-LD Schema
    let script = document.querySelector('#seo-schema');
    if (schema) {
      if (!script) {
        script = document.createElement('script');
        script.id = 'seo-schema';
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(schema);
    } else if (script) {
      script.remove();
    }
  }, [title, description, type, schema, image, twitterTitle, twitterDescription, twitterImage, location.pathname, location.search]);
}
