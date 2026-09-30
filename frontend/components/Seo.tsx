import Head from 'expo-router/head';

export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:8081').replace(/\/$/, '');

type Props = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  jsonLd?: object;
};

export function Seo({ title, description, path, noindex = false, jsonLd }: Props) {
  const url = `${SITE_URL}${path}`;
  const image = `${SITE_URL}/og-image.png`;
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="New Catch" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </Head>
  );
}