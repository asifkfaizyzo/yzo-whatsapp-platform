import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export function useFormHandler({ schema, defaultValues, onSubmitService, onSuccess }) {
  const [generalError, setGeneralError] = useState('');

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const onSubmit = async (data) => {
    setGeneralError('');
    
    const result = await onSubmitService(data);

    if (result.success) {
      if (onSuccess) onSuccess(result.data);
    } else {
      // 1. If backend returned field-level validation errors
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((err) => {
          // Strips backend response "body.email" -> "email"
          const fieldName = err.field.replace('body.', '');
          
          methods.setError(fieldName, {
            type: 'server',
            message: err.message,
          });
        });
      } else {
        // 2. If it's a general API failure (e.g. invalid credentials, 500 error)
        setGeneralError(result.message || 'Something went wrong. Please try again.');
      }
    }
  };

  return {
    ...methods,
    generalError,
    setGeneralError,
    onSubmit: methods.handleSubmit(onSubmit),
  };
}
