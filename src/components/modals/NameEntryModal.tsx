import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { User, LogIn } from 'lucide-react';

export const NameEntryModal: React.FC = () => {
  const { modalType, closeModal, setUserName } = useStudyRoom();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const isOpen = modalType === 'name-entry';

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('لطفاً نام یا نام مستعار خود را برای ورود به کلاس وارد کنید');
      return;
    }
    setError('');
    setUserName(name.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="ورود به کلاس — نام شما"
      subtitle="برای ورود به این کلاس، لطفاً نام خود را وارد کنید تا هم‌کلاسی‌ها شما را بشناسند."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="نام شما"
          placeholder="مثال: علی رضایی یا سارا"
          icon={<User className="w-4 h-4" />}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          error={error}
          autoFocus
          required
        />

        <p className="text-xs text-slate-500 dark:text-slate-400">
          این نام برای سایر هم‌کلاسی‌ها در چت و لیست آنلاین کلاس نمایش داده می‌شود.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={closeModal}>
            انصراف
          </Button>
          <Button type="submit" variant="primary" icon={<LogIn className="w-4 h-4" />}>
            ورود به کلاس
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default NameEntryModal;
