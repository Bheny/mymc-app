import { useState, useEffect } from 'react';

const bibleQuotes = [
  "The Lord is my shepherd; I shall not want. - Psalm 23:1",
  "I can do all things through Christ who strengthens me. - Philippians 4:13",
  "For I know the plans I have for you, declares the Lord. - Jeremiah 29:11",
  "Trust in the Lord with all your heart. - Proverbs 3:5",
  "Be strong and courageous. Do not be afraid; do not be discouraged. - Joshua 1:9",
];

function getRandomQuote() {
  return bibleQuotes[Math.floor(Math.random() * bibleQuotes.length)];
}

export default function Loader() {
  const [quote, setQuote] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark the component as mounted on the client
    setIsClient(true);
    
    // Update the quote after the component is mounted
    setQuote(getRandomQuote());

    const interval = setInterval(() => {
      setQuote(getRandomQuote());
    }, 5000); // Change quote every 5 seconds

    return () => clearInterval(interval); // Cleanup on component unmount
  }, []);

  if (!isClient) {
    return null; // Prevent content from rendering on the server
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-solid"></div>
      <p className="mt-4 text-center text-gray-700 text-sm italic">{quote}</p>
    </div>
  );
}
