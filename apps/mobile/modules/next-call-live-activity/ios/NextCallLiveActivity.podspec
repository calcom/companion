Pod::Spec.new do |s|
  s.name           = 'NextCallLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Live Activity for the next Cal.com call'
  s.description    = 'Starts, updates and ends the iOS Live Activity shown before the next booking.'
  s.author         = 'Cal.com'
  s.homepage       = 'https://cal.com'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
