/**
 * سياق المصادقة وإدارة صلاحيات الدخول للنظام
 * System Authentication & Access Control Context
 * الدخول محصور بمسؤول النظام الرئيسي (adn.ak21@atu.edu.iq / 570390) والمستخدمين المعتمدين في الإعدادات
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { localStore } from '../lib/supabase';
import { SystemUser } from '../types';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'staff' | 'editor';
  role_label: string;
  isSuperAdmin: boolean;
  registeredAt: string;
}

interface AuthContextType {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  loginWithPassword: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  resetSessionTimer: () => void;
  quickLogin: (email?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 دقيقة من عدم النشاط

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem('ce_admin_session');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });

  const lastActivityRef = useRef<number>(Date.now());

  // التحقق من انتهاء مهلة عدم النشاط
  useEffect(() => {
    if (!admin) return;

    const interval = setInterval(() => {
      const inactiveDuration = Date.now() - lastActivityRef.current;
      if (inactiveDuration >= INACTIVITY_TIMEOUT_MS) {
        console.warn('انتهت مهلة الجلسة بسبب عدم النشاط. تم تسجيل الخروج تلقائياً.');
        logout();
      }
    }, 30000);

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [admin]);

  /**
   * التحقق من بيانات الدخول بالبريد وكلمة المرور
   * 1. فحص مسؤول النظام الرئيسي الدائم (adn.ak21@atu.edu.iq / 570390)
   * 2. فحص المستخدمين المضافين في خانة الإعدادات من قبل المسؤول
   */
  const loginWithPassword = async (
    email: string, 
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail || !cleanPass) {
      return { success: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' };
    }

    // 1. مسؤول النظام الرئيسي
    if (cleanEmail === 'adn.ak21@atu.edu.iq' && cleanPass === '570390') {
      const superAdminUser: AdminUser = {
        id: 'super-admin-adn',
        email: 'adn.ak21@atu.edu.iq',
        name: 'مسؤول النظام الرئيسي',
        role: 'super_admin',
        role_label: 'مسؤول النظام العام (Super Admin)',
        isSuperAdmin: true,
        registeredAt: new Date().toISOString(),
      };

      setAdmin(superAdminUser);
      localStorage.setItem('ce_admin_session', JSON.stringify(superAdminUser));
      lastActivityRef.current = Date.now();
      return { success: true };
    }

    // 2. البحث في قائمة المستخدمين المصرح لهم المضافين في الإعدادات
    const settings = localStore.getSettings();
    const users: SystemUser[] = settings.authorized_users || [];

    const foundUser = users.find(
      (u) => u.email.trim().toLowerCase() === cleanEmail
    );

    if (!foundUser) {
      return { 
        success: false, 
        error: 'صلاحية الدخول مرفوضة. هذا الحساب غير مسجل كمستخدم مصرح له من قِبل مسؤول النظام.' 
      };
    }

    if (foundUser.is_active === false) {
      return { 
        success: false, 
        error: 'تم تعطيل هذا الحساب من قِبل مسؤول النظام. يرجى التواصل مع المشرف لتفعيل الحساب.' 
      };
    }

    if (foundUser.password !== cleanPass) {
      return { 
        success: false, 
        error: 'كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور المحددة لحسابك.' 
      };
    }

    // نجاح المصادقة كمستخدم مصرح له
    const sessionUser: AdminUser = {
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      role: foundUser.role,
      role_label: foundUser.role_label || (foundUser.role === 'super_admin' ? 'مسؤول النظام العام' : 'مستخدم مصرح له'),
      isSuperAdmin: foundUser.role === 'super_admin',
      registeredAt: new Date().toISOString(),
    };

    setAdmin(sessionUser);
    localStorage.setItem('ce_admin_session', JSON.stringify(sessionUser));
    lastActivityRef.current = Date.now();
    return { success: true };
  };

  const quickLogin = (userEmail = 'adn.ak21@atu.edu.iq') => {
    loginWithPassword(userEmail, '570390');
  };

  const logout = () => {
    setAdmin(null);
    localStorage.removeItem('ce_admin_session');
  };

  const resetSessionTimer = () => {
    lastActivityRef.current = Date.now();
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        loginWithPassword,
        logout,
        resetSessionTimer,
        quickLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
