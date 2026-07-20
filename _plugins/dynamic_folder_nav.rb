require "find"

# Builds a fully dynamic folder tree from the repository contents.
#
# The sidebar includes every directory under the repository root, regardless
# of whether the folder contains Markdown. Folders without a README link to
# the matching GitHub tree URL so users can browse raw files.
#
# Folders whose names start with a dot, plus `_site/`, `vendor/`, and
# `.bundle/`, are excluded. Symlinks are not followed.
module DynamicFolderNav
  class Generator < Jekyll::Generator
    EXCLUDED_PREFIXES = %w[. _site vendor .bundle _includes _layouts assets].freeze
    MAX_DEPTH = 4
    REPO_URL = "https://github.com/sglbl/gnulinux-config".freeze

    def generate(site)
      root = File.expand_path(site.source)
      tree = build_node(root, "")

      site.config["awesome_nav_tree"] = [tree]
      site.config["dynamic_folder_nav"] = [tree]

      site.pages.each do |page|
        page.data["dynamic_folder_nav"] = tree
      end
    end

    private

    def excluded?(dir_name)
      EXCLUDED_PREFIXES.any? { |prefix| dir_name == prefix || dir_name.start_with?("#{prefix}/") }
    end

    def visible?(absolute_path)
      base = File.basename(absolute_path)
      return false if base.start_with?(".")
      return false if excluded?(base)
      return false unless File.directory?(absolute_path)
      true
    end

    def build_node(absolute_dir, relative_dir)
      children = Dir
        .children(absolute_dir)
        .select { |name| visible?(File.join(absolute_dir, name)) }
        .sort
        .flat_map { |name| build_children(absolute_dir, relative_dir, name) }

      node = { "title" => title_for(relative_dir), "children" => children }
      if relative_dir != "" && readme?(absolute_dir)
        node["url"] = "/#{relative_dir}/"
      elsif relative_dir != ""
        node["url"] = github_url_for(relative_dir)
      end
      node
    end

    def build_children(absolute_dir, relative_dir, name)
      child_absolute = File.join(absolute_dir, name)
      child_relative = relative_dir.empty? ? name : File.join(relative_dir, name)

      if File.directory?(child_absolute)
        depth = child_relative.split("/").length
        return [] if depth > MAX_DEPTH
        [build_node(child_absolute, child_relative)]
      else
        []
      end
    end

    def readme?(absolute_dir)
      %w[README.md README.markdown readme.md].any? do |name|
        File.exist?(File.join(absolute_dir, name))
      end
    end

    def github_url_for(relative_dir)
      "#{REPO_URL}/tree/main/#{relative_dir}"
    end

    def title_for(relative_dir)
      relative_dir.empty? ? "Home" : titleize(File.basename(relative_dir))
    end

    def titleize(value)
      value.to_s
        .tr("_-", " ")
        .split
        .map { |part| part[0] ? "#{part[0].upcase}#{part[1..]}" : part }
        .join(" ")
    end
  end
end