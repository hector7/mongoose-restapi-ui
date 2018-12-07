require 'simplecov'
require 'coveralls'
require 'codeclimate-test-reporter'

CodeClimate::TestReporter.start

SimpleCov.start do
  add_filter '/spec/'
  add_filter '/config/'
  add_filter '/lib/tasks'
  add_filter '/lib/assets'
  add_filter '/vendor/'
  add_filter '/features/'
end