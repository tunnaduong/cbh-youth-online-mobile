Pod::Spec.new do |s|
  s.name           = 'CbhCallUi'
  s.version        = '1.0.0'
  s.summary        = 'Incoming calls through CallKit + PushKit for CBH Youth Online'
  s.description    = 'Reports incoming calls to CallKit from VoIP pushes so they ring like phone calls.'
  s.license        = 'MIT'
  s.author         = 'CBH Youth Online'
  s.homepage       = 'https://chuyenbienhoa.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CallKit', 'PushKit', 'AVFoundation'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
