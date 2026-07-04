import { useState, useEffect } from 'react';
import { DarkModeContext } from './DarkModeContext';


const DarkModeProvider = ({ children }) => {

  const [isDarkMode, setIsDarkMode] = useState(() => {

    const savedMode = localStorage.getItem('darkMode');

    if (savedMode !== null) {
      return savedMode === 'true';
    }

    return window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;

  });


  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };


  useEffect(() => {

    localStorage.setItem(
      'darkMode',
      isDarkMode
    );

    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }

  }, [isDarkMode]);



  useEffect(() => {

    const mediaQuery = window.matchMedia(
      '(prefers-color-scheme: dark)'
    );


    const handleChange = (e) => {

      if(localStorage.getItem('darkMode') === null){
        setIsDarkMode(e.matches);
      }

    };


    mediaQuery.addEventListener(
      'change',
      handleChange
    );


    return () => {
      mediaQuery.removeEventListener(
        'change',
        handleChange
      );
    };


  }, []);



  return (
    <DarkModeContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
        setIsDarkMode
      }}
    >
      {children}
    </DarkModeContext.Provider>
  );

};


export default DarkModeProvider;