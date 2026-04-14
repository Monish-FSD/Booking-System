import { useState, useEffect } from 'react'

const ADMIN_EMAIL = 'admin@hotel.com'
const ADMIN_PASSWORD = 'admin123456'
const ADMIN_KEY = 'admin_authenticated'

export const useAdminAuth = () => {
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === 'true')

  const adminLogin = (email, password) => {
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_KEY, 'true')
      setIsAdmin(true)
      return true
    }
    return false
  }

  const adminLogout = () => {
    sessionStorage.removeItem(ADMIN_KEY)
    setIsAdmin(false)
  }

  return { isAdmin, adminLogin, adminLogout }
}
