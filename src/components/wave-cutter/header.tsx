import React from "react";

const Header = () => {
  return (
    <header className="border-b-2 border-primary/50 pb-4 text-center">
      <h1 className="text-5xl font-bold text-primary inline-block">
        &gt; WAVE CUTTER<span className="blinking-cursor">_</span>
      </h1>
      <p className="text-foreground/80 mt-2">
        A retro tool for slicing and dicing .WAV files.
      </p>
    </header>
  );
};

export default Header;
