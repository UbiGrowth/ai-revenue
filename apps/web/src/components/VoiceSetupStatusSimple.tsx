// Simple Voice Setup Status - Fallback version
// Shows basic status without complex logic

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle2 } from 'lucide-react'

export function VoiceSetupStatusSimple() {
  return (
    <Alert className="bg-blue-50 border-blue-200">
      <CheckCircle2 className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800">Voice Agents</AlertTitle>
      <AlertDescription className="text-blue-700">
        Voice agent orchestration system is active. The system will automatically
        choose the best channel (voice call, voicemail, SMS, or email) for each lead.
      </AlertDescription>
    </Alert>
  )
}
