import { useAuth } from '../contexts/AuthContext'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { SERVER_URL } from '../constants'

interface SoundInfo {
  filename: string
  size: number
  url: string
  type: string
  uploaded: number
}

interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  recordingBlob: Blob | null
  recordingUrl: string | null
  duration: number
  fileExtension?: string
}

export default function Recordings() {
  const { isAdmin } = useAuth()
  const [soundInfo, setSoundInfo] = useState<SoundInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Recording state
  const [recording, setRecording] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    recordingBlob: null,
    recordingUrl: null,
    duration: 0,
  })
  const [recordingPermission, setRecordingPermission] = useState<
    boolean | null
  >(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCurrentSound = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`${SERVER_URL}/audio/current`)

      if (response.ok) {
        const data = await response.json()
        setSoundInfo(data)
      } else if (response.status === 404) {
        setSoundInfo(null)
      } else {
        throw new Error('Failed to fetch sound info')
      }
    } catch (error) {
      console.error('Error fetching current sound:', error)
      setSoundInfo(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchCurrentSound()
    }
  }, [isAdmin, fetchCurrentSound])

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${SERVER_URL}/audio/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess(`Successfully uploaded ${file.name}`)
        await fetchCurrentSound() // Refresh the current sound info
        if (fileInputRef.current) {
          fileInputRef.current.value = '' // Clear the input
        }
      } else {
        setUploadError(data.detail || 'Upload failed')
      }
    } catch (error) {
      setUploadError('Network error occurred during upload')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteSound = async () => {
    if (!soundInfo) return

    setIsLoading(true)
    try {
      const response = await fetch(`${SERVER_URL}/audio/current`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSoundInfo(null)
        setUploadSuccess('Sound deleted successfully')
      } else {
        const data = await response.json()
        setUploadError(data.detail || 'Failed to delete sound')
      }
    } catch (error) {
      setUploadError('Network error occurred during deletion')
      console.error('Delete error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatUploadDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Check microphone permission
  const checkMicrophonePermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setRecordingPermission(true)
    } catch (error) {
      console.error('Microphone permission denied:', error)
      setRecordingPermission(false)
    }
  }, [])

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      streamRef.current = stream
      chunksRef.current = []

      // Try different audio formats that are more likely to be supported by the server
      let mimeType = 'audio/webm;codecs=opus'
      let fileExtension = '.ogg'

      if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav'
        fileExtension = '.wav'
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
        fileExtension = '.ogg'
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
        fileExtension = '.ogg' // We'll treat webm as ogg for server compatibility
      } else {
        mimeType = 'audio/webm'
        fileExtension = '.ogg'
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Create blob with appropriate MIME type for server compatibility
        const blob = new Blob(chunksRef.current, {
          type: mimeType.includes('webm') ? 'audio/ogg' : mimeType,
        })
        const url = URL.createObjectURL(blob)

        setRecording((prev) => ({
          ...prev,
          recordingBlob: blob,
          recordingUrl: url,
          isRecording: false,
          isPaused: false,
          fileExtension, // Store the extension for later use
        }))

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
        }
      }

      mediaRecorder.start(100) // Collect data every 100ms
      setRecording((prev) => ({ ...prev, isRecording: true, duration: 0 }))

      // Start timer
      timerRef.current = setInterval(() => {
        setRecording((prev) => ({ ...prev, duration: prev.duration + 1 }))
      }, 1000)
    } catch (error) {
      console.error('Failed to start recording:', error)
      setUploadError('Failed to access microphone. Please check permissions.')
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop()
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // Discard recording
  const discardRecording = () => {
    if (recording.recordingUrl) {
      URL.revokeObjectURL(recording.recordingUrl)
    }

    setRecording({
      isRecording: false,
      isPaused: false,
      recordingBlob: null,
      recordingUrl: null,
      duration: 0,
      fileExtension: undefined,
    })

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // Upload recorded audio
  const uploadRecording = async () => {
    if (!recording.recordingBlob) return

    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    const formData = new FormData()
    const extension = recording.fileExtension || '.ogg'
    const filename = `recording-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}${extension}`
    formData.append('file', recording.recordingBlob, filename)

    try {
      const response = await fetch(`${SERVER_URL}/audio/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess(`Successfully uploaded recording`)
        await fetchCurrentSound()
        discardRecording() // Clear the recording
      } else {
        setUploadError(data.detail || 'Upload failed')
      }
    } catch (error) {
      setUploadError('Network error occurred during upload')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  // Check microphone permission on component mount
  useEffect(() => {
    if (isAdmin) {
      checkMicrophonePermission()
    }
  }, [isAdmin, checkMicrophonePermission])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (recording.recordingUrl) {
        URL.revokeObjectURL(recording.recordingUrl)
      }
    }
  }, [])

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Recordings</h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            You need administrator privileges to access recordings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Recordings</h2>

      {/* Success/Error Messages */}
      {uploadSuccess && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {uploadSuccess}
        </div>
      )}
      {uploadError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {uploadError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3 md:grid-cols-2">
        {/* Current Sound Player */}
        <Card>
          <CardHeader>
            <CardTitle>Current Sound</CardTitle>
            <CardDescription>
              The current notification sound that will be played by units
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : soundInfo ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">File:</span>
                    <code className="bg-muted px-2 py-1 rounded text-sm">
                      {soundInfo.filename}
                    </code>
                    <Badge variant="outline">
                      {soundInfo.type.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Size:</span>
                    <span className="text-muted-foreground">
                      {formatFileSize(soundInfo.size)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Uploaded:</span>
                    <span className="text-muted-foreground">
                      {formatUploadDate(soundInfo.uploaded)}
                    </span>
                  </div>
                </div>

                <audio
                  ref={audioRef}
                  controls
                  className="w-full"
                  src={`${SERVER_URL}/my-sound`}
                  key={soundInfo.uploaded} // Force reload when sound changes
                >
                  Your browser does not support the audio element.
                </audio>

                <Button
                  onClick={handleDeleteSound}
                  variant="destructive"
                  size="sm"
                  disabled={isLoading}
                >
                  Delete Current Sound
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No sound file currently uploaded
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload New Sound */}
        <Card>
          <CardHeader>
            <CardTitle>Upload New Sound</CardTitle>
            <CardDescription>
              Replace the current notification sound with a new audio file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Supported formats: MP3, WAV, OGG, M4A, AAC, FLAC
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,audio/*"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  file:disabled:opacity-50 file:disabled:pointer-events-none"
              />
            </div>

            {isUploading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">
                  Uploading...
                </span>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <p>• Uploading a new file will replace the current sound</p>
              <p>• The sound will be available immediately at /my-sound</p>
              <p>• All connected units will use the new sound</p>
            </div>
          </CardContent>
        </Card>

        {/* Record New Sound */}
        <Card>
          <CardHeader>
            <CardTitle>Record New Sound</CardTitle>
            <CardDescription>
              Record audio directly in your browser
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recordingPermission === false && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <p>Microphone access is required for recording.</p>
                <Button
                  onClick={checkMicrophonePermission}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Request Permission
                </Button>
              </div>
            )}

            {recordingPermission === true && (
              <div className="space-y-4">
                {/* Recording Controls */}
                {!recording.recordingBlob && (
                  <div className="text-center space-y-4">
                    {recording.isRecording ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-lg font-mono">
                            {formatDuration(recording.duration)}
                          </span>
                        </div>
                        <Button
                          onClick={stopRecording}
                          variant="destructive"
                          size="lg"
                        >
                          Stop Recording
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={startRecording}
                        size="lg"
                        className="w-full"
                      >
                        🎤 Start Recording
                      </Button>
                    )}
                  </div>
                )}

                {/* Playback Recorded Audio */}
                {recording.recordingBlob && recording.recordingUrl && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <Badge variant="outline">
                        Recorded: {formatDuration(recording.duration)}
                      </Badge>
                    </div>

                    <audio
                      controls
                      className="w-full"
                      src={recording.recordingUrl}
                    >
                      Your browser does not support the audio element.
                    </audio>

                    <div className="flex gap-2">
                      <Button
                        onClick={uploadRecording}
                        disabled={isUploading}
                        className="flex-1"
                      >
                        {isUploading ? 'Uploading...' : 'Use This Recording'}
                      </Button>
                      <Button
                        onClick={discardRecording}
                        variant="outline"
                        disabled={isUploading}
                      >
                        Discard
                      </Button>
                    </div>

                    <Button
                      onClick={() => {
                        discardRecording()
                      }}
                      variant="ghost"
                      size="sm"
                      className="w-full"
                    >
                      Record Again
                    </Button>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  <p>• Click "Start Recording" to begin</p>
                  <p>• Click "Stop Recording" when finished</p>
                  <p>• Preview your recording before uploading</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
