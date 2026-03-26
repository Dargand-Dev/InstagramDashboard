import { createContext, useContext, useState, useEffect } from 'react'

const IncognitoContext = createContext()

export function IncognitoProvider({ children }) {
  const [isIncognito, setIsIncognito] = useState(() => {
    try {
      return localStorage.getItem('incognito-mode') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    localStorage.setItem('incognito-mode', isIncognito)
  }, [isIncognito])

  const toggleIncognito = () => setIsIncognito(prev => !prev)

  return (
    <IncognitoContext.Provider value={{ isIncognito, toggleIncognito }}>
      {children}
    </IncognitoContext.Provider>
  )
}

export function useIncognito() {
  return useContext(IncognitoContext)
}

export function Blur({ children }) {
  const { isIncognito } = useContext(IncognitoContext)
  return <span className={isIncognito ? 'incognito-blur' : ''}>{children}</span>
}
