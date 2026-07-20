source "https://rubygems.org"

# Pin to Jekyll 4 (the github-pages gem would lock us to the whitelist,
# which excludes jekyll-awesome-nav — that's why we build in Actions).
gem "jekyll", "~> 4.3"
gem "jekyll-optional-front-matter", "~> 0.3"
gem "jekyll-readme-index", "~> 0.3"
gem "jekyll-awesome-nav"

# Windows and JRuby do not include zoneinfo files
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]