/*
 * SonarQube
 * Copyright (C) 2009-2016 SonarSource SA
 * mailto:contact AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

package org.sonar.server.authentication.ws;

import java.io.IOException;
import javax.annotation.Nullable;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.sonar.api.web.ServletFilter;
import org.sonar.db.DbClient;
import org.sonar.db.user.UserDto;
import org.sonar.server.authentication.CredentialsAuthenticator;
import org.sonar.server.authentication.JwtHttpHandler;
import org.sonar.server.authentication.event.AuthenticationEvent;
import org.sonar.server.authentication.event.AuthenticationException;
import org.sonar.server.exceptions.UnauthorizedException;
import org.sonar.server.user.ServerUserSession;
import org.sonar.server.user.ThreadLocalUserSession;

import static java.net.HttpURLConnection.HTTP_BAD_REQUEST;
import static java.net.HttpURLConnection.HTTP_UNAUTHORIZED;
import static org.apache.commons.lang.StringUtils.isEmpty;
import static org.sonar.server.authentication.event.AuthenticationEvent.Method;
import static org.sonar.server.authentication.event.AuthenticationEvent.Source;
import static org.sonarqube.ws.client.WsRequest.Method.POST;

public class LoginAction extends ServletFilter {

  public static final String AUTH_LOGIN_URL = "/api/authentication/login";

  private final DbClient dbClient;
  private final CredentialsAuthenticator credentialsAuthenticator;
  private final JwtHttpHandler jwtHttpHandler;
  private final ThreadLocalUserSession threadLocalUserSession;
  private final AuthenticationEvent authenticationEvent;

  public LoginAction(DbClient dbClient, CredentialsAuthenticator credentialsAuthenticator, JwtHttpHandler jwtHttpHandler,
    ThreadLocalUserSession threadLocalUserSession, AuthenticationEvent authenticationEvent) {
    this.dbClient = dbClient;
    this.credentialsAuthenticator = credentialsAuthenticator;
    this.jwtHttpHandler = jwtHttpHandler;
    this.threadLocalUserSession = threadLocalUserSession;
    this.authenticationEvent = authenticationEvent;
  }

  @Override
  public UrlPattern doGetPattern() {
    return UrlPattern.create(AUTH_LOGIN_URL);
  }

  @Override
  public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain chain) throws IOException, ServletException {
    HttpServletRequest request = (HttpServletRequest) servletRequest;
    HttpServletResponse response = (HttpServletResponse) servletResponse;

    if (!request.getMethod().equals(POST.name())) {
      response.setStatus(HTTP_BAD_REQUEST);
      return;
    }

    String login = request.getParameter("login");
    String password = request.getParameter("password");
    try {
      UserDto userDto = authenticate(request, login, password);
      jwtHttpHandler.generateToken(userDto, request, response);
      threadLocalUserSession.set(ServerUserSession.createForUser(dbClient, userDto));
      // TODO add chain.doFilter when Rack filter will not be executed after this filter (or use a Servlet)
    } catch (AuthenticationException e) {
      authenticationEvent.failure(request, e);
      response.setStatus(HTTP_UNAUTHORIZED);
    } catch (UnauthorizedException e) {
      response.setStatus(e.httpCode());
    }
  }

  private UserDto authenticate(HttpServletRequest request, @Nullable String login, @Nullable String password) {
    if (isEmpty(login) || isEmpty(password)) {
      throw AuthenticationException.newBuilder()
        .setSource(Source.local(Method.FORM))
        .setLogin(login)
        .setMessage("empty login and/or password")
        .build();
    }
    return credentialsAuthenticator.authenticate(login, password, request, Method.FORM);
  }

  @Override
  public void init(FilterConfig filterConfig) throws ServletException {
    // Nothing to do
  }

  @Override
  public void destroy() {
    // Nothing to do
  }
}
